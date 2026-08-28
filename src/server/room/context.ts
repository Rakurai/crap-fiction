import type { Charter } from '../model/charter.js'
import type { Fragment, PromptFragments, SectionName } from '../model/prompts.js'
import { renderFragment } from '../model/prompts.js'
import type { RoleDefinition } from '../model/roles.js'
import type { CallTurns } from '../model/types.js'
import type { ConversationEntry, ParticipantResponseEntry } from '../../shared/conversationEntries.js'
import type { SurfaceId } from '../../shared/surfaces.js'
import { RouteFailure } from '../routeFailure.js'

export type HistoryPolicy = 'shared' | 'stricter'

export const SHIPPED_HISTORY_POLICY: HistoryPolicy = 'shared'

export type HistoryEntry =
  | Readonly<{ kind: 'message'; text: string }>
  | Readonly<{ kind: 'request'; participant: string; clarification: string | undefined }>
  | Readonly<{ kind: 'response'; participant: string; claim: string; note: string | undefined }>
  | Readonly<{ kind: 'application'; participant: string; claim: string; note: string | undefined }>

export type ParticipantEvidence = Readonly<{ participant: string; claim: string; note: string | undefined }>

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

export class ParticipantNameUnknownError extends RouteFailure {
  constructor(participantId: string) {
    super('PROMPT_NOT_COMPILED', 'internal', `the conversation names a participant "${participantId}" the studio has no name for`)
    this.name = 'ParticipantNameUnknownError'
  }
}

export class AppliedResponseUnknownError extends RouteFailure {
  constructor(responseId: string) {
    super('PROMPT_NOT_COMPILED', 'internal', `the conversation records an application of a response "${responseId}" it does not hold`)
    this.name = 'AppliedResponseUnknownError'
  }
}

function displayNameFor(participants: ReadonlyMap<string, string>, id: string): string {
  const displayName = participants.get(id)
  if (displayName === undefined) throw new ParticipantNameUnknownError(id)
  return displayName
}

function appliedResponse(entries: readonly ConversationEntry[], responseId: string): ParticipantResponseEntry {
  for (const entry of entries) {
    if (entry.kind === 'participantResponse' && entry.id === responseId) return entry
  }
  throw new AppliedResponseUnknownError(responseId)
}

function historyEntryFor(
  entry: ConversationEntry,
  entries: readonly ConversationEntry[],
  participants: ReadonlyMap<string, string>,
): HistoryEntry | undefined {
  switch (entry.kind) {
    case 'authorMessage':
      return { kind: 'message', text: entry.text }
    case 'concreteChangeRequest':
      return { kind: 'request', participant: displayNameFor(participants, entry.target), clarification: entry.clarification }
    case 'participantResponse':
      return { kind: 'response', participant: displayNameFor(participants, entry.participantId), claim: entry.claim, note: entry.note }
    case 'application': {
      const applied = appliedResponse(entries, entry.responseId)
      return {
        kind: 'application',
        participant: displayNameFor(participants, applied.participantId),
        claim: applied.claim,
        note: applied.note,
      }
    }
    case 'participantNoComment':
    case 'participantFailure':
      return undefined
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}

function deriveHistory(
  entries: readonly ConversationEntry[] | undefined,
  keeps: (entry: ConversationEntry) => boolean,
  participants: ReadonlyMap<string, string>,
): readonly HistoryEntry[] {
  const all = entries ?? []
  const result: HistoryEntry[] = []
  for (const entry of all) {
    if (!keeps(entry)) continue
    const line = historyEntryFor(entry, all, participants)
    if (line !== undefined) result.push(line)
  }
  return result
}

function keepsEverything(): boolean {
  return true
}

function keepsUnder(policy: HistoryPolicy, roleId: string): (entry: ConversationEntry) => boolean {
  if (policy === 'shared') return keepsEverything
  return (entry) => entry.kind !== 'participantResponse' || entry.participantId === roleId
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
    history: deriveHistory(input.entries, keepsUnder(input.policy, input.role.id), input.participants),
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
    history: deriveHistory(input.entries, keepsEverything, input.participants),
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

function turns(standing: string, request: string): CallTurns {
  return [
    { role: 'system', content: standing },
    { role: 'user', content: request },
  ]
}

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
  return renderFragment(fragments.sections[name], { [variable]: value })
}

function historyLine(fragments: PromptFragments, entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'message':
      return renderFragment(fragments.lines.historyMessage, { text: entry.text })
    case 'request':
      return entry.clarification === undefined
        ? renderFragment(fragments.lines.historyRequest, { participant: entry.participant })
        : renderFragment(fragments.lines.historyRequestClarified, { participant: entry.participant, clarification: entry.clarification })
    case 'application':
      return renderFragment(fragments.lines.historyApplication, {
        participant: entry.participant,
        reading: readingValue(entry.claim, entry.note),
      })
    case 'response':
      return renderFragment(fragments.lines.historyResponse, { participant: entry.participant, reading: readingValue(entry.claim, entry.note) })
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}

function historyLines(fragments: PromptFragments, history: readonly HistoryEntry[]): string | undefined {
  if (history.length === 0) return undefined
  return history.map((entry) => historyLine(fragments, entry)).join('\n')
}

function readingsLines(fragments: PromptFragments, evidence: readonly ParticipantEvidence[]): string | undefined {
  if (evidence.length === 0) return undefined
  return evidence
    .map((entry) => renderFragment(fragments.lines.readingSubstantive, { participant: entry.participant, reading: readingValue(entry.claim, entry.note) }))
    .join('\n')
}

export function renderApplyPrompt(context: ApplyContext, fragments: PromptFragments): CallTurns {
  const standing = compose([context.modeDescription, fixedSection(fragments.roles.apply)])
  const request = compose([
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
  return turns(standing, request)
}

export function renderPrompt(context: Context, fragments: PromptFragments, charter: Charter): CallTurns {
  const task =
    context.ask !== undefined ? fragments.tasks.concreteChange : context.role.eligibility === 'generalist' ? fragments.tasks.generalist : fragments.tasks.specialist

  const standing = compose([
    context.modeDescription,
    renderFragment(fragments.sections.charter, { charter }),
    renderFragment(fragments.sections.role, { persona: context.role.persona }),
  ])

  const request = compose([
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

  return turns(standing, request)
}

