import type { Charter } from '../model/charter.js'
import type { ModelAccess } from '../model/modelAccess.js'
import type { RoleDefinition } from '../model/roles.js'
import type { Conversation, ParticipantResult, RoundParticipantRecord } from '../../shared/conversationViews.js'
import { responseValueSchema, type EligibleResponseValue, type OwedResponseValue } from '../../shared/participantResponse.js'
import { compileContext, renderPrompt, type HistoryPolicy, type ParticipantEvidence } from './context.js'

export type RoundPlan = Readonly<{
  roundId: string
  message: string | undefined
  /** Ids the author's message (or the act that opened the round) addressed. Empty means the round names no one. */
  addressedIds: readonly string[]
  /** The specialists this round will call, in the order it will call them. */
  specialists: readonly RoleDefinition[]
  /** Present, and last, exactly where the round will reach the Story Editor (CONTEXT "Round"). */
  storyEditor: RoleDefinition | undefined
}>

export type RoundCallbacks = Readonly<{
  onState: (participantId: string, state: 'preparing' | 'working') => void
  onSettled: (participantId: string, record: RoundParticipantRecord) => void
}>

export type RunRoundInput = Readonly<{
  plan: RoundPlan
  draft: string
  authorContext: string | undefined
  storyContext: string | undefined
  conversation: Conversation | undefined
  policy: HistoryPolicy
  charter: Charter
  modelAccess: ModelAccess
  signal: AbortSignal
  callbacks: RoundCallbacks
}>

export type RoundResult = Readonly<{
  participants: readonly RoundParticipantRecord[]
  outcome: 'settled' | 'abandoned'
}>

/**
 * Narrows what `responseValueSchema`'s `.refine` already proved at parse
 * time — a response that says anything states a claim — into the
 * discriminated shape the conversation record and every reader of it use.
 */
function toParticipantResult(value: EligibleResponseValue | OwedResponseValue): ParticipantResult {
  if (value.outcome === 'noComment') return { kind: 'response', outcome: 'noComment' }
  if (value.claim === undefined) {
    throw new Error('invariant violated: a response conformed to its schema without a claim')
  }
  return { kind: 'response', outcome: value.outcome, claim: value.claim, note: value.note }
}

async function callParticipant(
  role: RoleDefinition,
  prompt: string,
  owesAnswer: boolean,
  modelAccess: ModelAccess,
  signal: AbortSignal,
  onState: (state: 'preparing' | 'working') => void,
): Promise<RoundParticipantRecord> {
  const schema = responseValueSchema(owesAnswer)
  const result = await modelAccess.call(role.id, prompt, schema, signal, onState)

  const participantResult: ParticipantResult =
    result.outcome === 'value'
      ? toParticipantResult(result.value)
      : result.outcome === 'abandoned'
        ? { kind: 'abandoned' }
        : { kind: 'failed', reason: result.reason, returned: result.returned }

  return { participantId: role.id, result: participantResult }
}

function evidenceFrom(records: readonly RoundParticipantRecord[]): readonly ParticipantEvidence[] {
  return records
    .filter((record) => record.result.kind === 'response' && record.result.outcome !== 'noComment')
    .map((record) => {
      const result = record.result as Extract<typeof record.result, { kind: 'response'; outcome: 'commentary' | 'applicableSuggestion' }>
      return { participantId: record.participantId, claim: result.claim, note: result.note }
    })
}

/**
 * SPEC "The round": compiles every eligible specialist's context before any
 * call is issued, calls them one at a time in the cast's order, then — where
 * the round will reach it — compiles and calls the Story Editor over what
 * settled. Abandonment stops the round at the call in flight: calls not yet
 * issued are never issued and never appear in the result, and no Story
 * Editor call is attempted.
 */
export async function runRound(input: RunRoundInput): Promise<RoundResult> {
  const { plan, draft, authorContext, storyContext, conversation, policy, charter, modelAccess, signal, callbacks } = input

  const specialistPrompts = new Map(
    plan.specialists.map((role) => {
      const owesAnswer = plan.addressedIds.includes(role.id)
      const context = compileContext({
        role,
        owesAnswer,
        message: plan.message,
        authorContext,
        storyContext,
        draft,
        conversation,
        policy,
      })
      return [role.id, { prompt: renderPrompt(context, charter), owesAnswer }] as const
    }),
  )

  const records: RoundParticipantRecord[] = []
  let abandoned = false

  for (const role of plan.specialists) {
    if (signal.aborted) {
      abandoned = true
      break
    }
    const compiled = specialistPrompts.get(role.id)
    if (compiled === undefined) continue

    const record = await callParticipant(role, compiled.prompt, compiled.owesAnswer, modelAccess, signal, (state) =>
      callbacks.onState(role.id, state),
    )
    records.push(record)
    callbacks.onSettled(role.id, record)
    if (record.result.kind === 'abandoned') {
      abandoned = true
      break
    }
  }

  const storyEditor = plan.storyEditor
  if (!abandoned && storyEditor !== undefined) {
    if (signal.aborted) {
      abandoned = true
    } else {
      const evidence = evidenceFrom(records)
      const owesAnswer = plan.addressedIds.includes(storyEditor.id) || evidence.length === 0
      const context = compileContext({
        role: storyEditor,
        owesAnswer,
        message: plan.message,
        authorContext,
        storyContext,
        draft,
        conversation,
        policy,
        evidence,
      })
      const prompt = renderPrompt(context, charter)
      const record = await callParticipant(storyEditor, prompt, owesAnswer, modelAccess, signal, (state) => callbacks.onState(storyEditor.id, state))
      records.push(record)
      callbacks.onSettled(storyEditor.id, record)
      if (record.result.kind === 'abandoned') abandoned = true
    }
  }

  return { participants: records, outcome: abandoned ? 'abandoned' : 'settled' }
}
