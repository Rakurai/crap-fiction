import type { Charter } from '../model/charter.js'
import type { Fragment, PromptFragments, SectionName } from '../model/prompts.js'
import { renderFragment } from '../model/prompts.js'
import type { RoleDefinition } from '../model/roles.js'
import type { CallPrompt } from '../model/types.js'
import type { ConversationEntry } from '../../shared/conversationEntries.js'
import type { SurfaceId } from '../../shared/surfaces.js'

export type HistoryPolicy = 'shared' | 'stricter'

export const SHIPPED_HISTORY_POLICY: HistoryPolicy = 'shared'

export type HistoryEntry =
  | Readonly<{ kind: 'message'; text: string }>
  | Readonly<{ kind: 'response'; participant: string; claim: string; note: string | undefined }>

export type ParticipantEvidence = Readonly<{ kind: 'substantive'; participant: string; claim: string; note: string | undefined }>

export type AskContextInput = Readonly<{ claim: string; note: string | undefined; clarification: string | undefined }>

export type ContextInput = Readonly<{
  role: RoleDefinition
  modeDescription: string
  owesAnswer: boolean
  message: string | undefined
  ask: AskContextInput | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  surface: SurfaceId
  referenceSchema: string | undefined
  entries: readonly ConversationEntry[] | undefined
  policy: HistoryPolicy
  participants: ReadonlyMap<string, string>
}>

export type Context = Readonly<{
  role: RoleDefinition
  modeDescription: string
  owesAnswer: boolean
  message: string | undefined
  ask: AskContextInput | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  surface: SurfaceId
  referenceSchema: string | undefined
  history: readonly HistoryEntry[]
  evidence: readonly ParticipantEvidence[]
}>

function displayNameFor(participants: ReadonlyMap<string, string>, id: string): string {
  return participants.get(id) ?? id
}

function deriveHistory(
  entries: readonly ConversationEntry[] | undefined,
  policy: HistoryPolicy,
  roleId: string,
  participants: ReadonlyMap<string, string>,
): readonly HistoryEntry[] {
  const result: HistoryEntry[] = []
  for (const entry of entries ?? []) {
    if (entry.kind === 'authorMessage') {
      result.push({ kind: 'message', text: entry.text })
      continue
    }
    if (entry.kind !== 'participantResponse') continue
    if (policy === 'shared' || entry.participantId === roleId) {
      result.push({ kind: 'response', participant: displayNameFor(participants, entry.participantId), claim: entry.claim, note: entry.note })
    }
  }
  return result
}

function contextFrom(input: ContextInput, evidence: readonly ParticipantEvidence[]): Context {
  return {
    role: input.role,
    modeDescription: input.modeDescription,
    owesAnswer: input.owesAnswer,
    message: input.message,
    ask: input.ask,
    authorContext: input.authorContext,
    storyContext: input.storyContext,
    draft: input.draft,
    surface: input.surface,
    referenceSchema: input.referenceSchema,
    history: deriveHistory(input.entries, input.policy, input.role.id, input.participants),
    evidence,
  }
}

export function compileSpecialistContext(input: ContextInput): Context {
  return contextFrom(input, [])
}

export function compileStoryEditorContext(input: ContextInput, evidence: readonly ParticipantEvidence[]): Context {
  return contextFrom(input, evidence)
}

export class SpecialistIndependenceViolation extends Error {
  constructor(participant: string) {
    super(`the compiled context for "${participant}" carries a reading from the dispatch being formed`)
    this.name = 'SpecialistIndependenceViolation'
  }
}

export function assertSpecialistIndependence(contexts: readonly Context[]): void {
  for (const context of contexts) {
    if (context.evidence.length > 0) throw new SpecialistIndependenceViolation(context.role.displayName)
  }
}

export type ApplyContextInput = Readonly<{
  modeDescription: string
  recommendationClaim: string
  recommendationNote: string | undefined
  constraint: string | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  surface: SurfaceId
  referenceSchema: string | undefined
  entries: readonly ConversationEntry[]
  participants: ReadonlyMap<string, string>
}>

export type ApplyContext = Readonly<{
  modeDescription: string
  recommendationClaim: string
  recommendationNote: string | undefined
  constraint: string | undefined
  authorContext: string | undefined
  storyContext: string | undefined
  draft: string
  surface: SurfaceId
  referenceSchema: string | undefined
  history: readonly HistoryEntry[]
}>

function fullHistory(entries: readonly ConversationEntry[], participants: ReadonlyMap<string, string>): readonly HistoryEntry[] {
  const result: HistoryEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'authorMessage') result.push({ kind: 'message', text: entry.text })
    else if (entry.kind === 'participantResponse')
      result.push({ kind: 'response', participant: displayNameFor(participants, entry.participantId), claim: entry.claim, note: entry.note })
  }
  return result
}

export function compileApplyContext(input: ApplyContextInput): ApplyContext {
  return {
    modeDescription: input.modeDescription,
    recommendationClaim: input.recommendationClaim,
    recommendationNote: input.recommendationNote,
    constraint: input.constraint,
    authorContext: input.authorContext,
    storyContext: input.storyContext,
    draft: input.draft,
    surface: input.surface,
    referenceSchema: input.referenceSchema,
    history: fullHistory(input.entries, input.participants),
  }
}

function readingValue(claim: string, note: string | undefined): string {
  return note !== undefined ? `${claim} ${note}` : claim
}

function compose(parts: readonly string[]): string {
  return parts
    .filter((part) => part.length > 0)
    .map((part) => `${part}\n\n`)
    .join('')
}

function fixedSection(fragment: Fragment): string {
  return renderFragment(fragment, {})
}

/** What a task instruction calls the document it targets, so an Apply or a reading task names the surface it was actually issued for. */
const TARGET_DOCUMENT: Readonly<Record<SurfaceId, string>> = {
  draft: 'manuscript',
  storyContext: 'story context',
  authorContext: 'author context',
}

function taskSection(fragment: Fragment, surface: SurfaceId): string {
  return renderFragment(fragment, { targetDocument: TARGET_DOCUMENT[surface] })
}

function section(fragments: PromptFragments, name: SectionName, variable: string, value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) return ''
  return renderFragment(fragments.sections[name], { [variable]: value.trim() })
}

function historyLines(fragments: PromptFragments, history: readonly HistoryEntry[]): string | undefined {
  if (history.length === 0) return undefined
  return history
    .map((entry) =>
      entry.kind === 'message'
        ? renderFragment(fragments.lines.historyMessage, { text: entry.text })
        : renderFragment(fragments.lines.historyResponse, { participant: entry.participant, reading: readingValue(entry.claim, entry.note) }),
    )
    .join('\n')
}

function readingsLines(fragments: PromptFragments, evidence: readonly ParticipantEvidence[]): string | undefined {
  if (evidence.length === 0) return undefined
  return evidence
    .map((entry) => renderFragment(fragments.lines.readingSubstantive, { participant: entry.participant, reading: readingValue(entry.claim, entry.note) }))
    .join('\n')
}

export function renderApplyPrompt(context: ApplyContext, fragments: PromptFragments): CallPrompt {
  const durable = compose([context.modeDescription.trim(), fixedSection(fragments.roles.apply)])
  const perCall = compose([
    taskSection(fragments.tasks.apply, context.surface),
    fixedSection(fragments.surfaces[context.surface]),
    section(fragments, 'referenceSchema', 'referenceSchema', context.referenceSchema),
    section(fragments, 'authorContext', 'authorContext', context.authorContext),
    section(fragments, 'storyContext', 'storyContext', context.storyContext),
    section(fragments, 'manuscript', 'manuscript', context.draft),
    section(fragments, 'history', 'history', historyLines(fragments, context.history)),
    section(fragments, 'recommendation', 'recommendation', readingValue(context.recommendationClaim, context.recommendationNote)),
    section(fragments, 'constraint', 'constraint', context.constraint),
  ])
  return { durable, perCall }
}

export function renderPrompt(context: Context, fragments: PromptFragments, charter: Charter): CallPrompt {
  const task =
    context.ask !== undefined ? fragments.tasks.concreteChange : context.role.eligibility === 'generalist' ? fragments.tasks.generalist : fragments.tasks.specialist

  const durable = compose([
    context.modeDescription.trim(),
    renderFragment(fragments.sections.charter, { charter: charter.trim() }),
    renderFragment(fragments.sections.role, { persona: context.role.persona }),
  ])

  const perCall = compose([
    taskSection(task, context.surface),
    fixedSection(fragments.surfaces[context.surface]),
    section(fragments, 'referenceSchema', 'referenceSchema', context.referenceSchema),
    context.owesAnswer ? fixedSection(fragments.sections.addressed) : '',
    section(fragments, 'authorContext', 'authorContext', context.authorContext),
    section(fragments, 'storyContext', 'storyContext', context.storyContext),
    section(fragments, 'manuscript', 'manuscript', context.draft),
    section(fragments, 'history', 'history', historyLines(fragments, context.history)),
    section(fragments, 'readings', 'readings', readingsLines(fragments, context.evidence)),
    context.ask === undefined ? section(fragments, 'message', 'message', context.message) : '',
    context.ask === undefined ? '' : section(fragments, 'reading', 'reading', readingValue(context.ask.claim, context.ask.note)),
    context.ask?.clarification === undefined ? '' : section(fragments, 'clarification', 'clarification', context.ask.clarification),
  ])

  return { durable, perCall }
}

