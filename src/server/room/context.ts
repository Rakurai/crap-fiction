import type { Charter } from '../model/charter.js'
import type { RoleDefinition } from '../model/roles.js'
import type { Conversation, RoundRecord } from '../../shared/conversationViews.js'

export type HistoryPolicy = 'shared' | 'stricter'

export type HistoryEntry =
  | Readonly<{ kind: 'message'; text: string }>
  | Readonly<{ kind: 'response'; participantId: string; claim: string; note: string | undefined }>

export type ParticipantEvidence = Readonly<{ participantId: string; claim: string; note: string | undefined }>

export type ContextInput = Readonly<{
  role: RoleDefinition
  owesAnswer: boolean
  message: string | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  conversation: Conversation | undefined
  policy: HistoryPolicy
  /**
   * SPEC "Context compilation": the one asymmetry — supplied only for the
   * Story Editor's call, with the round's settled substantive specialist
   * responses from the round being formed, once they have all settled.
   */
  evidence?: readonly ParticipantEvidence[]
}>

export type Context = Readonly<{
  role: RoleDefinition
  owesAnswer: boolean
  message: string | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  history: readonly HistoryEntry[]
  evidence: readonly ParticipantEvidence[]
}>

function substantiveResponses(round: RoundRecord): readonly HistoryEntry[] {
  return round.participants
    .filter((record) => record.result.kind === 'response' && record.result.outcome !== 'noComment')
    .map((record) => {
      const result = record.result as Extract<typeof record.result, { kind: 'response'; outcome: 'commentary' | 'applicableSuggestion' }>
      return { kind: 'response', participantId: record.participantId, claim: result.claim, note: result.note }
    })
}

/**
 * SPEC "Context compilation": conversation history is supplied by policy.
 * Shared history is every prior round's message and every participant's
 * substantive response; the stricter policy keeps a participant's own prior
 * responses and filters every other specialist's. Under both, a no-comment
 * outcome and a failure are not readings and never appear — they are
 * recorded in the conversation and are not evidence (CONTEXT "Response").
 *
 * `conversation` never contains the round being formed: the room compiles
 * every eligible participant's context before that round's first call is
 * issued, so nothing from it exists yet to pass here. That is what makes the
 * independence invariant hold by construction rather than by a filter this
 * function would have to remember to apply.
 */
function deriveHistory(conversation: Conversation | undefined, policy: HistoryPolicy, roleId: string): readonly HistoryEntry[] {
  if (conversation === undefined) return []

  const entries: HistoryEntry[] = []
  for (const round of conversation.rounds) {
    if (round.outcome !== 'settled') continue
    if (round.message !== undefined) entries.push({ kind: 'message', text: round.message })

    const responses = substantiveResponses(round)
    entries.push(...(policy === 'shared' ? responses : responses.filter((entry) => entry.kind === 'response' && entry.participantId === roleId)))
  }
  return entries
}

/**
 * SPEC "Context compilation": `role definition + model configuration +
 * selected context compilation policy → participant call`. A pure function,
 * so the independence invariant is asserted against the object it
 * constructs rather than inferred from a rendered prompt.
 */
export function compileContext(input: ContextInput): Context {
  return {
    role: input.role,
    owesAnswer: input.owesAnswer,
    message: input.message,
    authorContext: input.authorContext,
    storyContext: input.storyContext,
    draft: input.draft,
    history: deriveHistory(input.conversation, input.policy, input.role.id),
    evidence: input.evidence ?? [],
  }
}

function section(heading: string, body: string | undefined): string {
  if (body === undefined || body.trim().length === 0) return ''
  return `## ${heading}\n\n${body.trim()}\n\n`
}

function historyText(history: readonly HistoryEntry[]): string {
  if (history.length === 0) return ''
  const lines = history.map((entry) =>
    entry.kind === 'message' ? `Author: ${entry.text}` : `${entry.participantId}: ${entry.note !== undefined ? `${entry.claim} ${entry.note}` : entry.claim}`,
  )
  return section('Conversation so far', lines.join('\n'))
}

function evidenceText(evidence: readonly ParticipantEvidence[]): string {
  if (evidence.length === 0) return ''
  const lines = evidence.map((entry) => (entry.note !== undefined ? `${entry.participantId}: ${entry.claim} ${entry.note}` : `${entry.participantId}: ${entry.claim}`))
  return section('Readings from this round', lines.join('\n'))
}

/**
 * SPEC "Model access": the prompt crosses as text rather than as messages.
 * A context section the author has not written is omitted entirely — no
 * empty heading — because a model reads an empty section as something to
 * remark on rather than as nothing having been said.
 */
export function renderPrompt(context: Context, charter: Charter): string {
  const parts = [
    section('Your role', context.role.roleDescription),
    section('What "no comment" means', charter.outcomes.noComment),
    section('What commentary means', charter.outcomes.commentary),
    section('What an applicable suggestion means', charter.outcomes.applicableSuggestion),
    context.owesAnswer ? section('You were addressed directly', charter.directQuestionOwedAnswer) : '',
    section('On the author\'s question', charter.noReasoningAboutTheAuthorsQuestion),
    section('Author context', context.authorContext),
    section('Story context', context.storyContext),
    section('Manuscript', context.draft),
    historyText(context.history),
    evidenceText(context.evidence),
    section("Author's message", context.message),
  ]
  return parts.filter((part) => part.length > 0).join('')
}
