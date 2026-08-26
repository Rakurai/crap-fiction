import { nanoid } from 'nanoid'
import type { AppliedChange } from '../../shared/appliedChange.js'
import type { Clock } from '../../shared/clock.js'
import type { Logger } from '../logger.js'
import type { Charter } from '../model/charter.js'
import type { PromptFragments } from '../model/prompts.js'
import type { CallResult, ModelAccess } from '../model/types.js'
import { applyResultSchema } from '../../shared/applyResult.js'
import type {
  ApplicationEntry,
  AuthorMessageEntry,
  ConcreteChangeRequestEntry,
  ConversationEntry,
} from '../../shared/conversationEntries.js'
import {
  type ActionFinishedEvent,
  type ActionStartedEvent,
  type ConversationActivitySnapshot,
  type ConversationErrorEvent,
  type ConversationFailureCode,
  type EntryAppendedEvent,
  type ParticipantActivityEvent,
} from '../../shared/conversationEvents.js'
import { PieceNotFoundError } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import { conversationScopeFor, roomScopeKey, type ConversationScope, type RoomScope } from '../scope.js'
import { ConversationEntryStore, readConversationEntries, readPiece, writeAppliedChange, writePieceCast } from '../store/index.js'
import { computeAppliedChangeContent } from './appliedChange.js'
import { parseAddressing } from './addressing.js'
import {
  assertSpecialistIndependence,
  compileApplyContext,
  compileSpecialistContext,
  compileStoryEditorContext,
  renderApplyPrompt,
  renderPrompt,
  type ContextInput,
  type HistoryPolicy,
  type ParticipantEvidence,
} from './context.js'
import type { ReadDurableContext } from './durableContext.js'
import { callParticipant, evidenceFrom } from './dispatch.js'
import { specialistsFor, type RoomRoster } from './roster.js'
import type { ModeDescriptor } from '../modes.js'

export type RoomEvent =
  | { readonly type: 'action.started'; readonly data: ActionStartedEvent }
  | { readonly type: 'participant.activity'; readonly data: ParticipantActivityEvent }
  | { readonly type: 'entry.appended'; readonly data: EntryAppendedEvent }
  | { readonly type: 'action.finished'; readonly data: ActionFinishedEvent }
  | { readonly type: 'error'; readonly data: ConversationErrorEvent }

export class RoomBusyError extends Error {
  constructor(pieceId: string, surface: string) {
    super(`an operation is already in flight for "${pieceId}" on its "${surface}" surface`)
    this.name = 'RoomBusyError'
  }
}

export class RecommendationNotFoundError extends Error {
  constructor(pieceId: string, responseId: string) {
    super(`no applicable suggestion at response "${responseId}" for piece "${pieceId}"`)
    this.name = 'RecommendationNotFoundError'
  }
}

export class CommentaryNotFoundError extends Error {
  constructor(pieceId: string, responseId: string) {
    super(`no commentary at response "${responseId}" for piece "${pieceId}"`)
    this.name = 'CommentaryNotFoundError'
  }
}

export class ParticipantNotFoundError extends Error {
  constructor(pieceId: string, participantId: string) {
    super(`no participant "${participantId}" in the room for piece "${pieceId}"`)
    this.name = 'ParticipantNotFoundError'
  }
}

export class ModeNotFoundError extends Error {
  constructor(modeId: string) {
    super(`no loaded mode "${modeId}"`)
    this.name = 'ModeNotFoundError'
  }
}

type Listener = (event: RoomEvent) => void

function failureText(err: unknown): string {
  return err instanceof Error ? err.message : 'the action stopped for a reason the studio cannot name'
}

export type DispatchOpening =
  | Readonly<{ kind: 'message'; text: string }>
  | Readonly<{ kind: 'targeted'; target: string; text: string }>
  | Readonly<{ kind: 'ask'; respondingTo: string; clarification: string | undefined }>

type ActiveDispatch = {
  readonly kind: 'dispatch'
  readonly roomScope: RoomScope
  readonly conversationId: string
  readonly actionId: string
  readonly sourceEntryId: string
  readonly audience: readonly string[]
  readonly states: Map<string, 'preparing' | 'working'>
  readonly controller: AbortController
  readonly startedAt: number
}

type RunningDispatch = ActiveDispatch & {
  readonly settlement: Promise<void>
}

type ActiveApply = {
  readonly kind: 'apply'
  readonly roomScope: RoomScope
  readonly conversationId: string
  readonly actionId: string
  readonly sourceEntryId: string
  readonly controller: AbortController
  readonly startedAt: number
}

type ActiveOperation = RunningDispatch | ActiveApply

type DispatchPlan = Readonly<{
  causeEntry: AuthorMessageEntry | ConcreteChangeRequestEntry
  message: string | undefined
  ask: { claim: string; note: string | undefined; clarification: string | undefined } | undefined
  addressedIds: readonly string[]
  eligibleSpecialists: readonly RoleDefinition[]
  eligibleAddressedOnly: readonly RoleDefinition[]
  storyEditorIncluded: boolean
  existingEntries: readonly ConversationEntry[]
  draft: string
  modeDescription: string
}>

function findResponse(
  entries: readonly ConversationEntry[],
  id: string,
): Extract<ConversationEntry, { kind: 'participantResponse' }> | undefined {
  const entry = entries.find((candidate) => candidate.id === id)
  return entry?.kind === 'participantResponse' ? entry : undefined
}

export class Room {
  readonly #modelAccess: ModelAccess
  readonly #readDurableContext: ReadDurableContext
  readonly #entries: ConversationEntryStore
  readonly #dataRoot: string
  readonly #logger: Logger
  readonly #now: Clock
  readonly #charter: Charter
  readonly #fragments: PromptFragments
  readonly #policy: HistoryPolicy
  readonly #specialists: readonly RoleDefinition[]
  readonly #storyEditor: RoleDefinition
  readonly #addressedOnly: readonly RoleDefinition[]
  readonly #modeDescriptions: ReadonlyMap<string, string>
  readonly #displayNames: ReadonlyMap<string, string>
  readonly #listeners = new Map<string, Set<Listener>>()
  readonly #operations = new Map<string, ActiveOperation>()

  constructor(
    modelAccess: ModelAccess,
    readDurableContext: ReadDurableContext,
    entries: ConversationEntryStore,
    dataRoot: string,
    roster: RoomRoster,
    modes: readonly ModeDescriptor[],
    charter: Charter,
    fragments: PromptFragments,
    policy: HistoryPolicy,
    logger: Logger,
    now: Clock,
  ) {
    this.#modelAccess = modelAccess
    this.#readDurableContext = readDurableContext
    this.#entries = entries
    this.#dataRoot = dataRoot
    this.#logger = logger
    this.#now = now
    this.#charter = charter
    this.#fragments = fragments
    this.#policy = policy
    this.#specialists = roster.specialists
    this.#storyEditor = roster.storyEditor
    this.#addressedOnly = roster.addressedOnly
    this.#modeDescriptions = new Map(modes.map((mode) => [mode.id, mode.description]))
    this.#displayNames = new Map([...roster.specialists, roster.storyEditor, ...roster.addressedOnly].map((role) => [role.id, role.displayName]))
  }

  specialists(): readonly RoleDefinition[] {
    return this.#specialists
  }

  storyEditor(): RoleDefinition {
    return this.#storyEditor
  }

  #modeDescriptionFor(modeId: string): string {
    const description = this.#modeDescriptions.get(modeId)
    if (description === undefined) throw new ModeNotFoundError(modeId)
    return description
  }

  subscribe(pieceId: string, listener: Listener): () => void {
    const set = this.#listeners.get(pieceId) ?? new Set()
    set.add(listener)
    this.#listeners.set(pieceId, set)
    return () => set.delete(listener)
  }

  #emit(pieceId: string, event: RoomEvent): void {
    for (const listener of this.#listeners.get(pieceId) ?? []) listener(event)
  }

  #operationFor(scope: RoomScope): ActiveOperation | undefined {
    return this.#operations.get(roomScopeKey(scope))
  }

  activitySnapshot(scope: RoomScope): ConversationActivitySnapshot | undefined {
    const operation = this.#operationFor(scope)
    if (operation === undefined) return undefined
    if (operation.kind === 'apply') {
      return {
        actionId: operation.actionId,
        conversationId: operation.conversationId,
        kind: 'apply',
        sourceEntryId: operation.sourceEntryId,
        startedAt: operation.startedAt,
      }
    }
    return {
      actionId: operation.actionId,
      conversationId: operation.conversationId,
      kind: 'dispatch',
      sourceEntryId: operation.sourceEntryId,
      audience: operation.audience,
      states: Object.fromEntries(operation.states),
      startedAt: operation.startedAt,
    }
  }

  settlement(scope: RoomScope): Promise<void> | undefined {
    const operation = this.#operationFor(scope)
    return operation?.kind === 'dispatch' ? operation.settlement : undefined
  }

  abandon(scope: RoomScope, actionId: string): void {
    const operation = this.#operationFor(scope)
    if (operation === undefined || operation.actionId !== actionId) return
    operation.controller.abort()
    this.#operations.delete(roomScopeKey(scope))
  }

  async dispatch(
    workspaceDir: string,
    roomScope: RoomScope,
    conversationId: string,
    opening: DispatchOpening,
    draft: string,
  ): Promise<{ conversationId: string; actionId: string }> {
    const pieceId = roomScope.pieceId
    const holder = this.#operationFor(roomScope)
    if (holder !== undefined) throw new RoomBusyError(pieceId, roomScope.surface)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const conversationScope = conversationScopeFor(workspaceDir, roomScope)
    const existingEntries = readConversationEntries(this.#dataRoot, conversationScope, conversationId)?.entries ?? []
    const modeDescription = this.#modeDescriptionFor(piece.metadata.mode)
    const modeSpecialists = specialistsFor(this.#specialists, piece.metadata.mode, roomScope.surface)
    const roster = [...modeSpecialists, this.#storyEditor, ...this.#addressedOnly]

    let addressedIds: readonly string[]
    let causeEntry: AuthorMessageEntry | ConcreteChangeRequestEntry
    let ask: { claim: string; note: string | undefined; clarification: string | undefined } | undefined
    let message: string | undefined

    if (opening.kind === 'message') {
      addressedIds = parseAddressing(opening.text, roster).map((role) => role.id)
      message = opening.text
      ask = undefined
      causeEntry = { id: nanoid(), kind: 'authorMessage', text: opening.text, audience: addressedIds, brought: [] }
    } else if (opening.kind === 'targeted') {
      if (!roster.some((role) => role.id === opening.target)) throw new ParticipantNotFoundError(pieceId, opening.target)
      addressedIds = [opening.target]
      message = opening.text
      ask = undefined
      causeEntry = { id: nanoid(), kind: 'authorMessage', text: opening.text, audience: addressedIds, brought: [] }
    } else {
      const response = findResponse(existingEntries, opening.respondingTo)
      if (response === undefined || response.outcome !== 'commentary') throw new CommentaryNotFoundError(pieceId, opening.respondingTo)
      addressedIds = [response.participantId]
      message = undefined
      ask = { claim: response.claim, note: response.note, clarification: opening.clarification }
      causeEntry = {
        id: nanoid(),
        kind: 'concreteChangeRequest',
        target: response.participantId,
        respondingTo: opening.respondingTo,
        clarification: opening.clarification,
      }
    }

    const enabledCast = piece.metadata.cast[roomScope.surface]
    const eligibleSpecialists =
      addressedIds.length === 0
        ? modeSpecialists.filter((role) => enabledCast.includes(role.id))
        : modeSpecialists.filter((role) => addressedIds.includes(role.id))
    const eligibleAddressedOnly = this.#addressedOnly.filter((role) => addressedIds.includes(role.id))

    const brought = addressedIds.length === 0 ? [] : eligibleSpecialists.map((role) => role.id).filter((id) => !enabledCast.includes(id))
    if (causeEntry.kind === 'authorMessage') causeEntry = { ...causeEntry, brought }

    const storyEditorIncluded = addressedIds.length === 0 || addressedIds.includes(this.#storyEditor.id)
    const audience = [
      ...eligibleSpecialists.map((role) => role.id),
      ...eligibleAddressedOnly.map((role) => role.id),
      ...(storyEditorIncluded ? [this.#storyEditor.id] : []),
    ]

    const actionId = nanoid()
    const startedAt = this.#now()

    const dispatchState: ActiveDispatch = {
      kind: 'dispatch',
      roomScope,
      conversationId,
      actionId,
      sourceEntryId: causeEntry.id,
      audience,
      states: new Map(),
      controller: new AbortController(),
      startedAt,
    }

    const plan: DispatchPlan = {
      causeEntry,
      message,
      ask,
      addressedIds,
      eligibleSpecialists,
      eligibleAddressedOnly,
      storyEditorIncluded,
      existingEntries,
      draft,
      modeDescription,
    }
    const cause = causeEntry
    const key = roomScopeKey(roomScope)

    const written = (async () => {
      if (brought.length > 0) await writePieceCast(workspaceDir, pieceId, roomScope.surface, [...enabledCast, ...brought])
      await this.#entries.append(this.#dataRoot, conversationScope, conversationId, cause)
    })()

    const settlement = written
      .then(
        () => {
          this.#emit(pieceId, {
            type: 'action.started',
            data: { actionId, conversationId, kind: 'dispatch', sourceEntryId: cause.id, startedAt, audience },
          })
          this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: cause } })
          return this.#run(workspaceDir, roomScope, conversationScope, conversationId, plan, dispatchState).catch((err: unknown) => {
            this.#fail(pieceId, actionId, 'UNEXPECTED_FAILURE', failureText(err), err)
          })
        },
        () => {},
      )
      .finally(() => {
        if (this.#operations.get(key)?.actionId === actionId) this.#operations.delete(key)
      })
    this.#operations.set(key, { ...dispatchState, settlement })

    await written
    return { conversationId, actionId }
  }

  #fail(pieceId: string, actionId: string, code: ConversationFailureCode, message: string, cause: unknown): void {
    this.#logger.error({ pieceId, actionId, code, err: cause }, 'conversation action failed')
    this.#emit(pieceId, { type: 'error', data: { code, message } })
    this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'failed' } })
  }

  async #run(
    workspaceDir: string,
    roomScope: RoomScope,
    conversationScope: ConversationScope,
    conversationId: string,
    plan: DispatchPlan,
    operation: ActiveDispatch,
  ): Promise<void> {
    const pieceId = roomScope.pieceId
    const { causeEntry, message, ask, addressedIds, eligibleSpecialists, eligibleAddressedOnly, storyEditorIncluded, existingEntries, draft, modeDescription } =
      plan
    const { actionId, controller } = operation
    const signal = controller.signal

    const durableContext = this.#readDurableContext(workspaceDir, pieceId)

    const shared = {
      message,
      ask,
      authorContext: durableContext.authorContext,
      storyContext: durableContext.storyContext,
      draft,
      surface: roomScope.surface,
      entries: existingEntries,
      policy: this.#policy,
      modeDescription,
      participants: this.#displayNames,
    }
    const contextFor = (role: RoleDefinition, owesAnswer: boolean): ContextInput => ({
      ...shared,
      role,
      owesAnswer,
    })

    const onState = (participantId: string, state: 'preparing' | 'working'): void => {
      operation.states.set(participantId, state)
      this.#emit(pieceId, { type: 'participant.activity', data: { actionId, participantId, state } })
    }

    const compiled = [...eligibleSpecialists, ...eligibleAddressedOnly].map((role) => {
      const owesAnswer = addressedIds.includes(role.id)
      return { role, owesAnswer, context: compileSpecialistContext(contextFor(role, owesAnswer)) }
    })
    assertSpecialistIndependence(compiled.map(({ context }) => context))
    const calls = compiled.map(({ role, owesAnswer, context }) => ({ role, owesAnswer, prompt: renderPrompt(context, this.#fragments, this.#charter) }))

    const evidence: ParticipantEvidence[] = []
    let abandoned = false
    let failed = false

    const reportFailureOnce = (message: string, err: unknown): void => {
      if (failed) return
      failed = true
      this.#fail(pieceId, actionId, 'CONVERSATION_NOT_WRITTEN', message, err)
    }

    const settleSpecialist = async (call: (typeof calls)[number]): Promise<void> => {
      const outcome = await callParticipant(call.role, call.prompt, causeEntry.id, call.owesAnswer, this.#modelAccess, signal, (state) =>
        onState(call.role.id, state),
      )
      operation.states.delete(call.role.id)

      if (outcome.kind === 'abandoned') {
        abandoned = true
        return
      }
      if (failed) return

      try {
        await this.#entries.append(this.#dataRoot, conversationScope, conversationId, outcome.entry)
      } catch (err) {
        reportFailureOnce(err instanceof Error ? err.message : 'the entry could not be written', err)
        return
      }
      this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: outcome.entry } })

      const gathered = evidenceFrom(outcome, call.role.displayName)
      if (gathered !== undefined) evidence.push(gathered)
    }

    await Promise.all(calls.map(settleSpecialist))

    if (!abandoned && !failed && storyEditorIncluded) {
      if (signal.aborted) {
        abandoned = true
      } else {
        const owesAnswer = addressedIds.includes(this.#storyEditor.id) || evidence.length === 0
        const prompt = renderPrompt(compileStoryEditorContext(contextFor(this.#storyEditor, owesAnswer), evidence), this.#fragments, this.#charter)
        const outcome = await callParticipant(this.#storyEditor, prompt, causeEntry.id, owesAnswer, this.#modelAccess, signal, (state) =>
          onState(this.#storyEditor.id, state),
        )
        operation.states.delete(this.#storyEditor.id)
        if (outcome.kind === 'abandoned') {
          abandoned = true
        } else {
          try {
            await this.#entries.append(this.#dataRoot, conversationScope, conversationId, outcome.entry)
          } catch (err) {
            reportFailureOnce(err instanceof Error ? err.message : 'the entry could not be written', err)
          }
          if (!failed) this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: outcome.entry } })
        }
      }
    }

    if (!failed) {
      this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: abandoned ? 'abandoned' : 'settled' } })
      this.#logger.info({ pieceId, actionId, outcome: abandoned ? 'abandoned' : 'settled' }, 'conversation action closed')
    }
  }

  async apply(
    workspaceDir: string,
    roomScope: RoomScope,
    conversationId: string,
    responseId: string,
    constraint: string | undefined,
    draft: string,
  ): Promise<{ actionId: string; result: CallResult<{ manuscript: string; change: AppliedChange | undefined; entryId: string | undefined }> }> {
    const pieceId = roomScope.pieceId
    const holder = this.#operationFor(roomScope)
    if (holder !== undefined) throw new RoomBusyError(pieceId, roomScope.surface)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const conversationScope = conversationScopeFor(workspaceDir, roomScope)
    const entries = readConversationEntries(this.#dataRoot, conversationScope, conversationId)?.entries ?? []
    const response = findResponse(entries, responseId)
    if (response === undefined || response.outcome !== 'applicableSuggestion') throw new RecommendationNotFoundError(pieceId, responseId)

    const durableContext = this.#readDurableContext(workspaceDir, pieceId)

    const actionId = nanoid()
    const controller = new AbortController()
    const startedAt = this.#now()
    const key = roomScopeKey(roomScope)
    this.#operations.set(key, { kind: 'apply', roomScope, conversationId, actionId, sourceEntryId: responseId, controller, startedAt })
    this.#emit(pieceId, {
      type: 'action.started',
      data: { actionId, conversationId, kind: 'apply', sourceEntryId: responseId, startedAt },
    })

    try {
      const context = compileApplyContext({
        modeDescription: this.#modeDescriptionFor(piece.metadata.mode),
        recommendationClaim: response.claim,
        recommendationNote: response.note,
        constraint,
        authorContext: durableContext.authorContext,
        storyContext: durableContext.storyContext,
        draft,
        surface: roomScope.surface,
        referenceSchema: undefined,
        entries,
        participants: this.#displayNames,
      })
      const prompt = renderApplyPrompt(context, this.#fragments)
      const result = await this.#modelAccess.call('apply', prompt, applyResultSchema, controller.signal)
      if (result.outcome !== 'value') {
        this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: result.outcome === 'abandoned' ? 'abandoned' : 'failed' } })
        return { actionId, result }
      }

      const { manuscript } = result.value
      if (manuscript === draft) {
        this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'settled' } })
        return { actionId, result: { outcome: 'value', value: { manuscript, change: undefined, entryId: undefined } } }
      }

      const changeId = nanoid()
      const change: AppliedChange = { id: changeId, content: computeAppliedChangeContent(draft, manuscript) }
      await writeAppliedChange(this.#dataRoot, conversationScope, change)
      const application: ApplicationEntry = { id: nanoid(), kind: 'application', responseId, changeId, constraint }
      await this.#entries.append(this.#dataRoot, conversationScope, conversationId, application)
      this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: { ...application, change: change.content } } })
      this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'settled' } })
      return { actionId, result: { outcome: 'value', value: { manuscript, change, entryId: application.id } } }
    } finally {
      if (this.#operations.get(key)?.actionId === actionId) this.#operations.delete(key)
    }
  }
}
