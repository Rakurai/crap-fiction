import type { Charter } from '../model/charter.js'
import type { RoleDefinition } from '../model/roles.js'
import type { ConversationEntry } from '../../shared/conversationEntries.js'

export type HistoryPolicy = 'shared' | 'stricter'

export const SHIPPED_HISTORY_POLICY: HistoryPolicy = 'shared'

export type HistoryEntry =
  | Readonly<{ kind: 'message'; text: string }>
  | Readonly<{ kind: 'response'; participantId: string; claim: string; note: string | undefined }>

// SPEC "Context compilation": a specialist's no-comment is not evidence and is excluded even from the
// Story Editor's own history; it is carried to the Story Editor only as the current dispatch's own
// evidence, below, never as something a later message's history recalls.
export type ParticipantEvidence =
  | Readonly<{ kind: 'substantive'; participantId: string; claim: string; note: string | undefined }>
  | Readonly<{ kind: 'noComment'; participantId: string }>

export type AskContextInput = Readonly<{ claim: string; note: string | undefined; clarification: string | undefined }>

export type SpecialistCriteria = Readonly<{ attendsTo: string; defect: string }>

export type ContextInput = Readonly<{
  role: RoleDefinition
  criteria: SpecialistCriteria | undefined
  owesAnswer: boolean
  message: string | undefined
  ask: AskContextInput | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  entries: readonly ConversationEntry[] | undefined
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

// Only an author message and a participant's substantive response carry into history: a no-comment
// outcome, a failure and an application never re-enter a model's context (SPEC "Context compilation",
// "Deliberately out"). A concrete-change request's own clarification is likewise never carried into
// later history — it is display-only (UX_DESIGN "Applying, and seeing what it did") — but the
// response it caused is, like any other.
function deriveHistory(entries: readonly ConversationEntry[] | undefined, policy: HistoryPolicy, roleId: string): readonly HistoryEntry[] {
  const result: HistoryEntry[] = []
  for (const entry of entries ?? []) {
    if (entry.kind === 'authorMessage') {
      result.push({ kind: 'message', text: entry.text })
      continue
    }
    if (entry.kind !== 'participantResponse') continue
    if (policy === 'shared' || entry.participantId === roleId) {
      result.push({ kind: 'response', participantId: entry.participantId, claim: entry.claim, note: entry.note })
    }
  }
  return result
}

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
    history: deriveHistory(input.entries, input.policy, input.role.id),
    evidence,
  }
}

export function compileSpecialistContext(input: ContextInput): Context {
  return contextFrom(input, [])
}

export function compileStoryEditorContext(input: ContextInput, evidence: readonly ParticipantEvidence[]): Context {
  return contextFrom(input, evidence)
}

export type ApplyContextInput = Readonly<{
  recommendationClaim: string
  recommendationNote: string | undefined
  constraint: string | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  entries: readonly ConversationEntry[]
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

function fullHistory(entries: readonly ConversationEntry[]): readonly HistoryEntry[] {
  const result: HistoryEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'authorMessage') result.push({ kind: 'message', text: entry.text })
    else if (entry.kind === 'participantResponse') result.push({ kind: 'response', participantId: entry.participantId, claim: entry.claim, note: entry.note })
  }
  return result
}

// SPEC "Applying a recommendation": Apply reads the full current conversation at the moment it is
// invoked, not the prefix through the recommendation — intervening discussion may qualify or
// contradict an old recommendation, and the write process must weigh that rather than replay against
// stale history.
export function compileApplyContext(input: ApplyContextInput): ApplyContext {
  return {
    recommendationClaim: input.recommendationClaim,
    recommendationNote: input.recommendationNote,
    constraint: input.constraint,
    authorContext: input.authorContext,
    storyContext: input.storyContext,
    draft: input.draft,
    history: fullHistory(input.entries),
  }
}

const APPLY_INSTRUCTION =
  "Revise the manuscript so that it embodies the recommendation below, honoring the author's constraint where one is given. Change only what embodying the recommendation and the constraint requires — nothing else about the prose. Return the manuscript whole."

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

// SPEC "Context compilation": a no-comment reaches the Story Editor as an attributed craft finding —
// a specialist explicitly finding nothing material — never as a roster, an attendance fact, a tally
// or a consensus signal.
function evidenceText(evidence: readonly ParticipantEvidence[]): string {
  if (evidence.length === 0) return ''
  const lines = evidence.map((entry) =>
    entry.kind === 'noComment'
      ? `${entry.participantId} found nothing material in its discipline.`
      : entry.note !== undefined
        ? `${entry.participantId}: ${entry.claim} ${entry.note}`
        : `${entry.participantId}: ${entry.claim}`,
  )
  return section('Specialist readings', lines.join('\n'))
}

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

export type CaptureContextInput = Readonly<{
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  entries: readonly ConversationEntry[] | undefined
}>

export type CaptureContext = Readonly<{
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  history: readonly HistoryEntry[]
}>

export function compileCaptureContext(input: CaptureContextInput): CaptureContext {
  return {
    authorContext: input.authorContext,
    storyContext: input.storyContext,
    draft: input.draft,
    history: input.entries === undefined ? [] : fullHistory(input.entries),
  }
}

const CAPTURE_INSTRUCTION = `Read the manuscript and the conversation below, together with the durable contexts that already stand, and propose granular changes to those contexts — nothing more than what the material actually supports.

Each proposal names its destination: story context, for what appears settled or intentionally decided about this piece, or author context, for a preference that genuinely generalizes beyond it. The bar for author context is substantially higher than for story context — most proposals belong to story context, and an author-context proposal should be rare, offered only where the evidence that a preference holds beyond this one piece is strong.

A proposal may add a new entry, revise or replace an existing one that no longer holds as stated, or remove one that is no longer true. Where a proposal concerns an existing entry, quote it exactly as it already appears, under the section it already belongs to. State only what should change, not everything the material mentions.`

export function renderCapturePrompt(context: CaptureContext): string {
  const parts = [
    section('What to do', CAPTURE_INSTRUCTION),
    section('Author context', context.authorContext),
    section('Story context', context.storyContext),
    section('Manuscript', context.draft),
    historyText(context.history),
  ]
  return parts.filter((part) => part.length > 0).join('')
}
