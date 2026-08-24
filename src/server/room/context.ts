import type { Charter } from '../model/charter.js'
import type { RoleDefinition } from '../model/roles.js'
import { substantiveResponse, type Conversation, type RoundRecord } from '../../shared/conversationViews.js'

export type HistoryPolicy = 'shared' | 'stricter'

/**
 * SPEC "Context compilation": "Shared history is the default", and which policy
 * produces better collaboration is an empirical question, so switching must stay
 * a configuration change rather than a redesign. It is stated here, once, and
 * carried to the room by the composition root — not as a parameter default,
 * which would let a caller that named no policy silently get this one
 * (CODING_STANDARDS "No defaults and no placeholders").
 */
export const SHIPPED_HISTORY_POLICY: HistoryPolicy = 'shared'

export type HistoryEntry =
  | Readonly<{ kind: 'message'; text: string }>
  | Readonly<{ kind: 'response'; participantId: string; claim: string; note: string | undefined }>

export type ParticipantEvidence = Readonly<{ participantId: string; claim: string; note: string | undefined }>

/**
 * What a specialist's call carries when the round is asking it for a concrete
 * change, rather than the response it is asking about's full identity — the
 * room resolves `respondingTo` to this before the call is compiled, so nothing
 * downstream of the room reads the conversation a second time to find it.
 */
export type AskContextInput = Readonly<{ claim: string; note: string | undefined; clarification: string | undefined }>

/**
 * What the mode says this specialist applies at this scale (CONTEXT "Mode"). It
 * is the mode's rather than the role's because the same specialist attends to
 * different things at different lengths, which is the one axis this software is
 * scoped along. `undefined` for the Story Editor, which is no part of the cast
 * and has no criteria to apply — SPEC "Context compilation" says so, and its role
 * definition is what tells it what it is for instead.
 */
export type SpecialistCriteria = Readonly<{ attendsTo: string; defect: string }>

/** Everything a call's context is built from that does not depend on whose call it is. */
export type ContextInput = Readonly<{
  role: RoleDefinition
  criteria: SpecialistCriteria | undefined
  owesAnswer: boolean
  message: string | undefined
  /** Present exactly where the round is asking this call's own participant for a concrete change. */
  ask: AskContextInput | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  conversation: Conversation | undefined
  policy: HistoryPolicy
}>

export type Context = Readonly<{
  role: RoleDefinition
  criteria: SpecialistCriteria | undefined
  owesAnswer: boolean
  message: string | undefined
  ask: AskContextInput | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  history: readonly HistoryEntry[]
  evidence: readonly ParticipantEvidence[]
}>

function substantiveResponses(round: RoundRecord): readonly HistoryEntry[] {
  return round.participants.flatMap((record) => {
    const response = substantiveResponse(record.result)
    if (response === undefined) return []
    return [{ kind: 'response', participantId: record.participantId, claim: response.claim, note: response.note } as const]
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
    // Every round the record holds counts, abandoned ones included: SPEC "The
    // round" has landed responses standing as ordinary responses when the
    // author stops a round, and the message that opened it was still said.
    // Skipping them here would delete the author's own words from every later
    // call, which reads to a participant as a conversation that never happened.
    if (round.message !== undefined) entries.push({ kind: 'message', text: round.message })

    const responses = substantiveResponses(round)
    entries.push(...(policy === 'shared' ? responses : responses.filter((entry) => entry.kind === 'response' && entry.participantId === roleId)))
  }
  return entries
}

/**
 * SPEC "Context compilation": `role definition + the mode's criteria for that
 * participant + model configuration + selected context compilation policy →
 * participant call`. A pure function,
 * so the independence invariant is asserted against the object it
 * constructs rather than inferred from a rendered prompt.
 */
function contextFrom(input: ContextInput, evidence: readonly ParticipantEvidence[]): Context {
  return {
    role: input.role,
    criteria: input.criteria,
    owesAnswer: input.owesAnswer,
    message: input.message,
    ask: input.ask,
    authorContext: input.authorContext,
    storyContext: input.storyContext,
    draft: input.draft,
    history: deriveHistory(input.conversation, input.policy, input.role.id),
    evidence,
  }
}

/**
 * A specialist's call. SPEC "Context compilation" makes the independence
 * invariant hold by construction, and this is where the construction is: there
 * is no parameter through which the round's other readings could arrive, so a
 * specialist context carrying one is not a mistake a caller can make. The
 * ordering rule the room follows — compile every specialist before issuing the
 * first call — is then a second guarantee rather than the only one.
 */
export function compileSpecialistContext(input: ContextInput): Context {
  return contextFrom(input, [])
}

/**
 * The Story Editor's call, and the one asymmetry SPEC "Context compilation"
 * names: it alone weighs the round's own readings. `evidence` is required
 * rather than optional because the Story Editor's whole reason to be called
 * last is that it has them — an absent one would mean the round reached here
 * without settling anything, which is a different call the room makes
 * deliberately by passing an empty list.
 */
export function compileStoryEditorContext(input: ContextInput, evidence: readonly ParticipantEvidence[]): Context {
  return contextFrom(input, evidence)
}

/** Everything an application's call is built from that does not depend on the conversation it reads through. */
export type ApplyContextInput = Readonly<{
  recommendationClaim: string
  recommendationNote: string | undefined
  constraint: string | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  conversation: Conversation
  /** The round the recommendation being applied came from — history is read through this round and no further. */
  throughRoundId: string
}>

export type ApplyContext = Readonly<{
  recommendationClaim: string
  recommendationNote: string | undefined
  constraint: string | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  history: readonly HistoryEntry[]
}>

/**
 * CONTEXT "Apply": the conversation through the recommendation being applied
 * — every round up to and including the one that produced it, on shared
 * history's own terms (every message, every substantive response), and
 * nothing from a round that followed. The recommendation is interpreted
 * against what the author had read when it was made, not against exchanges
 * that came after.
 */
function historyThrough(conversation: Conversation, throughRoundId: string): readonly HistoryEntry[] {
  const entries: HistoryEntry[] = []
  for (const round of conversation.rounds) {
    if (round.message !== undefined) entries.push({ kind: 'message', text: round.message })
    entries.push(...substantiveResponses(round))
    if (round.id === throughRoundId) break
  }
  return entries
}

/**
 * SPEC "Context compilation": `compileContext`'s third call kind — an
 * application, with the recommendation and the author's constraint — compiled
 * by the same family of pure functions a participant's call is, so the
 * invariant it is asserted against is the constructed object rather than a
 * rendered prompt.
 */
export function compileApplyContext(input: ApplyContextInput): ApplyContext {
  return {
    recommendationClaim: input.recommendationClaim,
    recommendationNote: input.recommendationNote,
    constraint: input.constraint,
    authorContext: input.authorContext,
    storyContext: input.storyContext,
    draft: input.draft,
    history: historyThrough(input.conversation, input.throughRoundId),
  }
}

/**
 * The one instruction an application's call carries that no participant's
 * does — deterministic and never displayed, the same way the instruction
 * behind asking a participant for a concrete change is not (SPEC "The
 * round"). SPEC "Applying a recommendation": stable input does not imply
 * restrained output, so the instruction says exactly what is licensed to
 * change and no more.
 */
const APPLY_INSTRUCTION =
  "Revise the manuscript so that it embodies the recommendation below, honoring the author's constraint where one is given. Change only what embodying the recommendation and the constraint requires — nothing else about the prose. Return the manuscript whole."

/**
 * The one instruction a round asking for a concrete change carries that no
 * other participant's call does — deterministic and never displayed, the same
 * way `APPLY_INSTRUCTION` above is not (SPEC "The round"). It stands in the
 * slot an author's message would otherwise fill; the two never appear
 * together, because CONTEXT "Round" has this round carrying no message.
 */
const ASK_INSTRUCTION =
  'The author found the reading below worth acting on but it named no action. Say plainly what you would change in the manuscript to act on it — an applicable suggestion where you have one — rather than elaborating on the reading itself.'

function askText(ask: AskContextInput | undefined): string {
  if (ask === undefined) return ''
  const reading = ask.note !== undefined ? `${ask.claim} ${ask.note}` : ask.claim
  const clarification = ask.clarification !== undefined ? `\n\nThe author added: ${ask.clarification}` : ''
  return `${ASK_INSTRUCTION}\n\n${reading}${clarification}`
}

export function renderApplyPrompt(context: ApplyContext, charter: Charter): string {
  const recommendation =
    context.recommendationNote !== undefined ? `${context.recommendationClaim} ${context.recommendationNote}` : context.recommendationClaim

  const parts = [
    section('What to do', APPLY_INSTRUCTION),
    section('What a recommendation is', charter.recommendationIsOneChange),
    section('Author context', context.authorContext),
    section('Story context', context.storyContext),
    section('Manuscript', context.draft),
    historyText(context.history),
    section('The recommendation being applied', recommendation),
    section("The author's constraint", context.constraint),
  ]
  return parts.filter((part) => part.length > 0).join('')
}

function section(heading: string, body: string | undefined): string {
  if (body === undefined || body.trim().length === 0) return ''
  return `## ${heading}\n\n${body.trim()}\n\n`
}

/**
 * What the participant is for, in one section: its role definition, and where the
 * mode names criteria for it, what it attends to at this scale and the defect it
 * is alert to. They are one section rather than two because they are one
 * statement — a specialist reading its criteria under a separate heading would be
 * reading them as a second job.
 */
function roleText(context: Context): string {
  const criteria = context.criteria
  const body =
    criteria === undefined
      ? context.role.roleDescription
      : [
          context.role.roleDescription,
          `At this scale you attend to: ${criteria.attendsTo}`,
          `The defect you are alert to: ${criteria.defect}`,
        ].join('\n\n')
  return section('Your role', body)
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
    roleText(context),
    section('What "no comment" means', charter.outcomes.noComment),
    section('What commentary means', charter.outcomes.commentary),
    section('What an applicable suggestion means', charter.outcomes.applicableSuggestion),
    section('What a recommendation is', charter.recommendationIsOneChange),
    context.owesAnswer ? section('You were addressed directly', charter.directQuestionOwedAnswer) : '',
    section('On the author\'s question', charter.noReasoningAboutTheAuthorsQuestion),
    section('Author context', context.authorContext),
    section('Story context', context.storyContext),
    section('Manuscript', context.draft),
    historyText(context.history),
    evidenceText(context.evidence),
    section("Author's message", context.message),
    section('Asked for a concrete change', askText(context.ask)),
  ]
  return parts.filter((part) => part.length > 0).join('')
}
