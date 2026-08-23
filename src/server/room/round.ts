import type { Charter } from '../model/charter.js'
import type { ModelAccess } from '../model/modelAccess.js'
import type { RoleDefinition } from '../model/roles.js'
import {
  substantiveResponse,
  type Conversation,
  type ParticipantResult,
  type RoundParticipantRecord,
} from '../../shared/conversationViews.js'
import { responseValueSchema, type EligibleResponseValue, type OwedResponseValue } from '../../shared/participantResponse.js'
import {
  compileSpecialistContext,
  compileStoryEditorContext,
  renderPrompt,
  type ContextInput,
  type HistoryPolicy,
  type ParticipantEvidence,
} from './context.js'

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
 * Carries a parsed response into the discriminated shape the conversation
 * record and every reader of it use.
 *
 * The claim-absent branch is unreachable by contract:
 * `eligibleResponseValueSchema` refuses a claimless response that says
 * something, and the owed schema types the claim as present. It is still
 * written, because SPEC "Model access" keeps that schema three flat fields for
 * constrained decoding's sake rather than a union, so the guarantee lives in a
 * `.refine` the inferred type cannot express. Reaching it would mean the schema
 * and its refinement had come apart — which is a response that does not conform,
 * and `nonconforming` is what the model boundary already calls that. A claim
 * invented here instead would be prose the author never received.
 */
function toParticipantResult(value: EligibleResponseValue | OwedResponseValue): ParticipantResult {
  if (value.outcome === 'noComment') return { kind: 'response', outcome: 'noComment' }
  if (value.claim === undefined) return { kind: 'failed', reason: 'nonconforming' }
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
  return records.flatMap((record) => {
    const response = substantiveResponse(record.result)
    if (response === undefined) return []
    return [{ participantId: record.participantId, claim: response.claim, note: response.note }]
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

  const shared = { message: plan.message, authorContext, storyContext, draft, conversation, policy }
  const contextFor = (role: RoleDefinition, owesAnswer: boolean): ContextInput => ({ ...shared, role, owesAnswer })

  // Every specialist's prompt, complete, before the first call goes out. The
  // list is built rather than a map keyed by id so that iterating it needs no
  // lookup and therefore no branch for a lookup that missed — a `continue` on
  // an absent prompt would silently drop a specialist from the round.
  const calls = plan.specialists.map((role) => {
    const owesAnswer = plan.addressedIds.includes(role.id)
    return { role, owesAnswer, prompt: renderPrompt(compileSpecialistContext(contextFor(role, owesAnswer)), charter) }
  })

  const records: RoundParticipantRecord[] = []
  let abandoned = false

  for (const call of calls) {
    if (signal.aborted) {
      abandoned = true
      break
    }

    const record = await callParticipant(call.role, call.prompt, call.owesAnswer, modelAccess, signal, (state) =>
      callbacks.onState(call.role.id, state),
    )
    records.push(record)
    callbacks.onSettled(call.role.id, record)
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
      // Addressed directly, it owes an answer for the ordinary reason. With no
      // readings to weigh it owes one too: SPEC "The round" has the round that
      // produced no answer saying so, and a Story Editor free to return no
      // comment on a quiet round would leave the author with a round that
      // reported nothing and explained nothing.
      const owesAnswer = plan.addressedIds.includes(storyEditor.id) || evidence.length === 0
      const prompt = renderPrompt(compileStoryEditorContext(contextFor(storyEditor, owesAnswer), evidence), charter)
      const record = await callParticipant(storyEditor, prompt, owesAnswer, modelAccess, signal, (state) => callbacks.onState(storyEditor.id, state))
      records.push(record)
      callbacks.onSettled(storyEditor.id, record)
      if (record.result.kind === 'abandoned') abandoned = true
    }
  }

  return { participants: records, outcome: abandoned ? 'abandoned' : 'settled' }
}
