import { nanoid } from 'nanoid'
import { canonicalMarkdown } from '../../document/markdown.js'
import type { AppliedChange, AppliedChangeContent } from '../../shared/appliedChange.js'
import { appliedChangeSchema } from '../../shared/appliedChange.js'
import type { ApplyOutcome } from '../../shared/applyViews.js'
import type { Clock } from '../../shared/clock.js'
import type { Logger } from '../logger.js'
import type { ModelAccess } from '../model/types.js'
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
  type ApplyPendingEvent,
  type ConversationActivitySnapshot,
  type ConversationErrorEvent,
  type ConversationFailureCode,
  type EntryAppendedEvent,
  type ParticipantActivityEvent,
  type ParticipantState,
  type RoomActivitySnapshot,
} from '../../shared/conversationEvents.js'
import type { DocumentSnapshot, SurfaceId } from '../../shared/surfaces.js'
import { ConversationNotFoundError, deleteConversation, PieceNotFoundError, startConversation } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import { RouteFailure } from '../routeFailure.js'
import { conversationScopeFor, roomScopeKey, type ConversationScope, type RoomScope } from '../scope.js'
import {
  ConversationEntryStore,
  readAppliedChanges,
  readAuthorContext,
  readConversationEntries,
  readPiece,
  readStoryContext,
  writeApplication,
  writeDispatchCause,
} from '../store/index.js'
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
import { callParticipant, evidenceFrom } from './dispatch.js'
import type { ShippedContentCatalog } from '../shippedContent.js'

export type RoomEvent =
  | { readonly type: 'action.started'; readonly data: ActionStartedEvent }
  | { readonly type: 'apply.pending'; readonly data: ApplyPendingEvent }
  | { readonly type: 'participant.activity'; readonly data: ParticipantActivityEvent }
  | { readonly type: 'entry.appended'; readonly data: EntryAppendedEvent }
  | { readonly type: 'action.finished'; readonly data: ActionFinishedEvent }
  | { readonly type: 'error'; readonly data: ConversationErrorEvent }

export class RoomBusyError extends RouteFailure {
  constructor(pieceId: string, surface: string) {
    super('ROOM_BUSY', 'conflict', `an operation is already in flight for "${pieceId}" on its "${surface}" surface`)
    this.name = 'RoomBusyError'
  }
}

export class RecommendationNotFoundError extends RouteFailure {
  constructor(pieceId: string, responseId: string) {
    super('RECOMMENDATION_NOT_FOUND', 'not_found', `no applicable suggestion at response "${responseId}" for piece "${pieceId}"`)
    this.name = 'RecommendationNotFoundError'
  }
}

export class ApplicationNotPendingError extends RouteFailure {
  constructor(pieceId: string, applicationId: string) {
    super('APPLICATION_NOT_PENDING', 'not_found', `no pending or committed application "${applicationId}" for piece "${pieceId}"`)
    this.name = 'ApplicationNotPendingError'
  }
}

export class ApplicationDocumentNotSavedError extends RouteFailure {
  constructor(pieceId: string, applicationId: string) {
    super('APPLICATION_DOCUMENT_NOT_SAVED', 'conflict', `application "${applicationId}" for piece "${pieceId}" does not match the document as saved`)
    this.name = 'ApplicationDocumentNotSavedError'
  }
}

export class CommentaryNotFoundError extends RouteFailure {
  constructor(pieceId: string, responseId: string) {
    super('COMMENTARY_NOT_FOUND', 'not_found', `no commentary at response "${responseId}" for piece "${pieceId}"`)
    this.name = 'CommentaryNotFoundError'
  }
}

export class ParticipantNotFoundError extends RouteFailure {
  constructor(pieceId: string, participantId: string) {
    super('PARTICIPANT_NOT_FOUND', 'not_found', `no participant "${participantId}" in the room for piece "${pieceId}"`)
    this.name = 'ParticipantNotFoundError'
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
  readonly states: Map<string, ParticipantState>
  readonly controller: AbortController
  readonly startedAt: number
}

type RunningDispatch = ActiveDispatch & {
  readonly settlement: Promise<void>
}

type PendingReplacement = Readonly<{
  applicationId: string
  responseId: string
  constraint: string | undefined
  replacement: string
  change: AppliedChange
}>

type ActiveApply = {
  readonly kind: 'apply'
  readonly roomScope: RoomScope
  readonly conversationScope: ConversationScope
  readonly conversationId: string
  readonly actionId: string
  readonly sourceEntryId: string
  readonly controller: AbortController
  readonly startedAt: number
  readonly pending?: PendingReplacement
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
  documents: DocumentSnapshot
  modeDescription: string
  interviewerReference: string | undefined
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
  readonly #entries: ConversationEntryStore
  readonly #dataRoot: string
  readonly #logger: Logger
  readonly #now: Clock
  readonly #catalog: ShippedContentCatalog
  readonly #policy: HistoryPolicy
  readonly #listeners = new Map<string, Set<Listener>>()
  readonly #operations = new Map<string, ActiveOperation>()
  readonly #minted = new Set<string>()
  #currentPieceId: string | undefined

  constructor(
    modelAccess: ModelAccess,
    entries: ConversationEntryStore,
    dataRoot: string,
    catalog: ShippedContentCatalog,
    policy: HistoryPolicy,
    logger: Logger,
    now: Clock,
  ) {
    this.#modelAccess = modelAccess
    this.#entries = entries
    this.#dataRoot = dataRoot
    this.#logger = logger
    this.#now = now
    this.#catalog = catalog
    this.#policy = policy
  }

  subscribe(pieceId: string, listener: Listener): () => void {
    const set = this.#listeners.get(pieceId) ?? new Set()
    set.add(listener)
    this.#listeners.set(pieceId, set)
    return () => set.delete(listener)
  }

  /**
   * Capturing the snapshot and registering the listener happen in the same synchronous step as
   * this transition, with no `await` between them, so no event can land in the gap.
   */
  connect(pieceId: string, listener: Listener): Readonly<{ snapshot: RoomActivitySnapshot; unsubscribe: () => void }> {
    if (this.#currentPieceId !== undefined && this.#currentPieceId !== pieceId) this.#abandonPiece(this.#currentPieceId)
    this.#currentPieceId = pieceId

    const at = (surface: SurfaceId): ConversationActivitySnapshot | null => this.activitySnapshot({ pieceId, surface }) ?? null
    const snapshot: RoomActivitySnapshot = { draft: at('draft'), storyContext: at('storyContext'), authorContext: at('authorContext') }
    const unsubscribe = this.subscribe(pieceId, listener)
    return { snapshot, unsubscribe }
  }

  #abandonPiece(pieceId: string): void {
    for (const operation of [...this.#operations.values()]) {
      if (operation.roomScope.pieceId === pieceId) this.abandon(operation.roomScope, operation.actionId)
    }
  }

  #emit(pieceId: string, event: RoomEvent): void {
    for (const listener of this.#listeners.get(pieceId) ?? []) listener(event)
  }

  #operationFor(scope: RoomScope): ActiveOperation | undefined {
    return this.#operations.get(roomScopeKey(scope))
  }

  #owns(scope: RoomScope, actionId: string): boolean {
    return this.#operations.get(roomScopeKey(scope))?.actionId === actionId
  }

  #release(scope: RoomScope, actionId: string): void {
    if (this.#owns(scope, actionId)) this.#operations.delete(roomScopeKey(scope))
  }

  #finish(scope: RoomScope, actionId: string, outcome: 'settled' | 'abandoned' | 'failed'): void {
    if (!this.#owns(scope, actionId)) return
    this.#operations.delete(roomScopeKey(scope))
    this.#emit(scope.pieceId, { type: 'action.finished', data: { actionId, outcome, surface: scope.surface } })
  }

  mintConversation(workspaceDir: string, roomScope: RoomScope): { readonly id: string } {
    const minted = startConversation(workspaceDir, roomScope.pieceId)
    this.#minted.add(minted.id)
    return minted
  }

  async deleteConversation(workspaceDir: string, roomScope: RoomScope, conversationId: string): Promise<void> {
    const operation = this.#operationFor(roomScope)
    if (operation?.conversationId === conversationId) throw new RoomBusyError(roomScope.pieceId, roomScope.surface)
    this.#minted.delete(conversationId)
    await deleteConversation(this.#dataRoot, workspaceDir, roomScope.pieceId, roomScope.surface, conversationId)
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
        applicationId: operation.pending?.applicationId,
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
    this.#finish(scope, actionId, 'abandoned')
  }

  async dispatch(
    workspaceDir: string,
    roomScope: RoomScope,
    conversationId: string,
    opening: DispatchOpening,
    documents: DocumentSnapshot,
  ): Promise<{ conversationId: string; actionId: string }> {
    const pieceId = roomScope.pieceId
    const holder = this.#operationFor(roomScope)
    if (holder !== undefined) throw new RoomBusyError(pieceId, roomScope.surface)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const conversationScope = conversationScopeFor(workspaceDir, roomScope)
    const onDisk = readConversationEntries(this.#dataRoot, conversationScope, conversationId)
    if (onDisk === undefined && !this.#minted.has(conversationId)) throw new ConversationNotFoundError(pieceId, conversationId)
    const existingEntries = onDisk?.entries ?? []
    const modeDescription = this.#catalog.mode(piece.metadata.mode).description
    const modeSpecialists = this.#catalog.specialistsFor(piece.metadata.mode, roomScope.surface)
    const roster = [...modeSpecialists, this.#catalog.roster.storyEditor, ...this.#catalog.roster.addressedOnly]

    const startedAt = this.#now()

    let addressedIds: readonly string[]
    let causeEntry: AuthorMessageEntry | ConcreteChangeRequestEntry
    let ask: { claim: string; note: string | undefined; clarification: string | undefined } | undefined
    let message: string | undefined

    if (opening.kind === 'message') {
      addressedIds = parseAddressing(opening.text, roster).map((role) => role.id)
      message = opening.text
      ask = undefined
      causeEntry = { id: nanoid(), kind: 'authorMessage', text: opening.text, audience: addressedIds, brought: [], atMs: startedAt }
    } else if (opening.kind === 'targeted') {
      if (!roster.some((role) => role.id === opening.target)) throw new ParticipantNotFoundError(pieceId, opening.target)
      addressedIds = [opening.target]
      message = opening.text
      ask = undefined
      causeEntry = { id: nanoid(), kind: 'authorMessage', text: opening.text, audience: addressedIds, brought: [], atMs: startedAt }
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
        atMs: startedAt,
      }
    }

    const enabledCast = piece.metadata.cast[roomScope.surface]
    const eligibleSpecialists =
      addressedIds.length === 0
        ? modeSpecialists.filter((role) => enabledCast.includes(role.id))
        : modeSpecialists.filter((role) => addressedIds.includes(role.id))
    const eligibleAddressedOnly = this.#catalog.roster.addressedOnly.filter((role) => addressedIds.includes(role.id))

    const brought = addressedIds.length === 0 ? [] : eligibleSpecialists.map((role) => role.id).filter((id) => !enabledCast.includes(id))
    if (causeEntry.kind === 'authorMessage') causeEntry = { ...causeEntry, brought, castSize: enabledCast.length + brought.length }

    const storyEditorIncluded = addressedIds.length === 0 || addressedIds.includes(this.#catalog.roster.storyEditor.id)
    const audience = [
      ...eligibleSpecialists.map((role) => role.id),
      ...eligibleAddressedOnly.map((role) => role.id),
      ...(storyEditorIncluded ? [this.#catalog.roster.storyEditor.id] : []),
    ]

    const actionId = nanoid()

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
      documents,
      modeDescription,
      interviewerReference: this.#catalog.referenceFor(piece.metadata.mode, roomScope.surface) ?? undefined,
    }
    const cause = causeEntry

    let settled!: () => void
    const settlement = new Promise<void>((resolve) => {
      settled = resolve
    })
    this.#operations.set(roomScopeKey(roomScope), { ...dispatchState, settlement })

    const written = (async () => {
      if (!this.#owns(roomScope, actionId)) return
      await writeDispatchCause(
        workspaceDir,
        pieceId,
        roomScope.surface,
        brought.length > 0 ? [...enabledCast, ...brought] : undefined,
        this.#dataRoot,
        conversationScope,
        conversationId,
        this.#entries,
        cause,
      )
      this.#minted.delete(conversationId)
    })()

    void written
      .then(
        async () => {
          if (!this.#owns(roomScope, actionId)) return
          this.#emit(pieceId, {
            type: 'action.started',
            data: { actionId, conversationId, kind: 'dispatch', sourceEntryId: cause.id, startedAt, audience, surface: roomScope.surface },
          })
          if (!this.#owns(roomScope, actionId)) return
          this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: cause, surface: roomScope.surface } })
          await this.#run(roomScope, conversationScope, conversationId, plan, dispatchState).catch((err: unknown) => {
            this.#fail(roomScope, actionId, 'UNEXPECTED_FAILURE', failureText(err), err)
          })
        },
        () => {},
      )
      .finally(() => {
        this.#release(roomScope, actionId)
        settled()
      })

    await written
    return { conversationId, actionId }
  }

  #fail(scope: RoomScope, actionId: string, code: ConversationFailureCode, message: string, cause: unknown): void {
    this.#logger.error({ pieceId: scope.pieceId, actionId, code, err: cause }, 'conversation action failed')
    if (!this.#owns(scope, actionId)) return
    this.#emit(scope.pieceId, { type: 'error', data: { code, message, surface: scope.surface } })
    this.#finish(scope, actionId, 'failed')
  }

  async #run(
    roomScope: RoomScope,
    conversationScope: ConversationScope,
    conversationId: string,
    plan: DispatchPlan,
    operation: ActiveDispatch,
  ): Promise<void> {
    const pieceId = roomScope.pieceId
    const {
      causeEntry,
      message,
      ask,
      addressedIds,
      eligibleSpecialists,
      eligibleAddressedOnly,
      storyEditorIncluded,
      existingEntries,
      documents,
      modeDescription,
      interviewerReference,
    } = plan
    const { actionId, controller } = operation
    const signal = controller.signal

    const shared = {
      message,
      ask,
      authorContext: documents.authorContext,
      storyContext: documents.storyContext,
      draft: documents.draft,
      surface: roomScope.surface,
      entries: existingEntries,
      policy: this.#policy,
      modeDescription,
      participants: this.#catalog.participantDisplayNames,
    }
    const contextFor = (role: RoleDefinition, owesAnswer: boolean): ContextInput => ({
      ...shared,
      role,
      owesAnswer,
      referenceSchema: role.id === this.#catalog.roster.interviewer.role.id ? interviewerReference : undefined,
    })

    const onState = (participantId: string, state: ParticipantState['state']): void => {
      const startedAt = operation.states.get(participantId)?.startedAt ?? this.#now()
      operation.states.set(participantId, { state, startedAt })
      if (!this.#owns(roomScope, actionId)) return
      this.#emit(pieceId, { type: 'participant.activity', data: { actionId, participantId, state, startedAt, surface: roomScope.surface } })
    }

    const compiled = [...eligibleSpecialists, ...eligibleAddressedOnly].map((role) => {
      const owesAnswer = addressedIds.includes(role.id)
      return { role, owesAnswer, context: compileSpecialistContext(contextFor(role, owesAnswer)) }
    })
    assertSpecialistIndependence(compiled.map(({ context }) => context))
    const calls = compiled.map(({ role, owesAnswer, context }) => ({
      role,
      owesAnswer,
      prompt: renderPrompt(context, this.#catalog.fragments, this.#catalog.charter),
    }))

    const evidence: ParticipantEvidence[] = []
    let abandoned = false
    let failed = false

    const reportFailureOnce = (message: string, err: unknown): void => {
      if (failed) return
      failed = true
      this.#fail(roomScope, actionId, 'CONVERSATION_NOT_WRITTEN', message, err)
    }

    const settleSpecialist = async (call: (typeof calls)[number]): Promise<void> => {
      onState(call.role.id, 'waiting')
      const outcome = await callParticipant(call.role, call.prompt, causeEntry.id, call.owesAnswer, this.#modelAccess, signal, (state) =>
        onState(call.role.id, state),
      )
      operation.states.delete(call.role.id)

      if (outcome.kind === 'abandoned') {
        abandoned = true
        return
      }
      if (failed) return
      if (!this.#owns(roomScope, actionId)) {
        abandoned = true
        return
      }

      try {
        await this.#entries.append(this.#dataRoot, conversationScope, conversationId, outcome.entry)
      } catch (err) {
        reportFailureOnce(err instanceof Error ? err.message : 'the entry could not be written', err)
        return
      }
      if (!this.#owns(roomScope, actionId)) return
      this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: outcome.entry, surface: roomScope.surface } })

      const gathered = evidenceFrom(outcome, call.role.displayName)
      if (gathered !== undefined) evidence.push(gathered)
    }

    await Promise.all(calls.map(settleSpecialist))

    if (!abandoned && !failed && storyEditorIncluded) {
      if (signal.aborted) {
        abandoned = true
      } else {
        // Reaching here is itself the decision that the Story Editor speaks: an addressed dispatch
        // has already excluded it unless it was named, so every call it does receive owes an answer.
        const storyEditor = this.#catalog.roster.storyEditor
        const prompt = renderPrompt(compileStoryEditorContext(contextFor(storyEditor, true), evidence), this.#catalog.fragments, this.#catalog.charter)
        onState(storyEditor.id, 'waiting')
        const outcome = await callParticipant(storyEditor, prompt, causeEntry.id, true, this.#modelAccess, signal, (state) =>
          onState(storyEditor.id, state),
        )
        operation.states.delete(storyEditor.id)
        if (outcome.kind === 'abandoned' || !this.#owns(roomScope, actionId)) {
          abandoned = true
        } else {
          try {
            await this.#entries.append(this.#dataRoot, conversationScope, conversationId, outcome.entry)
          } catch (err) {
            reportFailureOnce(err instanceof Error ? err.message : 'the entry could not be written', err)
          }
          if (!failed && this.#owns(roomScope, actionId)) {
            this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: outcome.entry, surface: roomScope.surface } })
          }
        }
      }
    }

    if (!failed) {
      const outcome = abandoned ? 'abandoned' : 'settled'
      this.#finish(roomScope, actionId, outcome)
      this.#logger.info({ pieceId, actionId, outcome }, 'conversation action closed')
    }
  }

  async apply(
    workspaceDir: string,
    roomScope: RoomScope,
    conversationId: string,
    responseId: string,
    constraint: string | undefined,
    documents: DocumentSnapshot,
  ): Promise<{ actionId: string; outcome: ApplyOutcome }> {
    const pieceId = roomScope.pieceId
    const holder = this.#operationFor(roomScope)
    if (holder !== undefined) throw new RoomBusyError(pieceId, roomScope.surface)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const conversationScope = conversationScopeFor(workspaceDir, roomScope)
    const entries = readConversationEntries(this.#dataRoot, conversationScope, conversationId)?.entries ?? []
    const response = findResponse(entries, responseId)
    if (response === undefined || response.outcome !== 'applicableSuggestion') throw new RecommendationNotFoundError(pieceId, responseId)

    const target = documents[roomScope.surface]
    const actionId = nanoid()
    const controller = new AbortController()
    const startedAt = this.#now()
    const key = roomScopeKey(roomScope)
    this.#operations.set(key, { kind: 'apply', roomScope, conversationScope, conversationId, actionId, sourceEntryId: responseId, controller, startedAt })
    this.#emit(pieceId, {
      type: 'action.started',
      data: { actionId, conversationId, kind: 'apply', sourceEntryId: responseId, startedAt, surface: roomScope.surface },
    })

    const closeOut = (outcome: 'settled' | 'abandoned' | 'failed'): void => {
      this.#finish(roomScope, actionId, outcome)
    }

    try {
      const context = compileApplyContext({
        modeDescription: this.#catalog.mode(piece.metadata.mode).description,
        recommendationClaim: response.claim,
        recommendationNote: response.note,
        constraint,
        authorContext: documents.authorContext,
        storyContext: documents.storyContext,
        draft: documents.draft,
        surface: roomScope.surface,
        referenceSchema: this.#catalog.referenceFor(piece.metadata.mode, roomScope.surface) ?? undefined,
        entries,
        participants: this.#catalog.participantDisplayNames,
      })
      const prompt = renderApplyPrompt(context, this.#catalog.fragments)
      const result = await this.#modelAccess.call('apply', prompt, applyResultSchema, controller.signal)
      if (result.outcome !== 'value') {
        closeOut(result.outcome === 'abandoned' ? 'abandoned' : 'failed')
        return {
          actionId,
          outcome:
            result.outcome === 'abandoned'
              ? { outcome: 'abandoned', actionId }
              : { outcome: 'failed', actionId, reason: result.reason, returned: result.returned },
        }
      }

      const replacement = roomScope.surface === 'draft' ? canonicalMarkdown(result.value.replacement) : result.value.replacement
      if (replacement === target) {
        closeOut('settled')
        return { actionId, outcome: { outcome: 'noChange', actionId } }
      }

      const pending: PendingReplacement = {
        applicationId: nanoid(),
        responseId,
        constraint,
        replacement,
        change: { id: nanoid(), content: computeAppliedChangeContent(target, replacement) },
      }
      const current = this.#operations.get(key)
      if (current?.kind === 'apply' && current.actionId === actionId) this.#operations.set(key, { ...current, pending })
      this.#emit(pieceId, {
        type: 'apply.pending',
        data: {
          actionId,
          conversationId,
          applicationId: pending.applicationId,
          sourceEntryId: responseId,
          surface: roomScope.surface,
        },
      })
      return { actionId, outcome: { outcome: 'pending', actionId, applicationId: pending.applicationId, replacement } }
    } catch (err) {
      closeOut('failed')
      throw err
    }
  }

  pendingReplacement(roomScope: RoomScope, conversationId: string, applicationId: string): string {
    const operation = this.#operationFor(roomScope)
    if (operation?.kind !== 'apply' || operation.conversationId !== conversationId || operation.pending?.applicationId !== applicationId) {
      throw new ApplicationNotPendingError(roomScope.pieceId, applicationId)
    }
    return operation.pending.replacement
  }

  async confirmApply(
    workspaceDir: string,
    roomScope: RoomScope,
    conversationId: string,
    applicationId: string,
  ): Promise<{ entryId: string; change: AppliedChangeContent }> {
    const pieceId = roomScope.pieceId
    const operation = this.#operationFor(roomScope)
    const conversationScope = conversationScopeFor(workspaceDir, roomScope)

    if (operation?.kind !== 'apply' || operation.pending?.applicationId !== applicationId) {
      const existing = readConversationEntries(this.#dataRoot, conversationScope, conversationId)?.entries.find(
        (entry): entry is ApplicationEntry => entry.kind === 'application' && entry.id === applicationId,
      )
      if (existing === undefined) throw new ApplicationNotPendingError(pieceId, applicationId)
      const change = readAppliedChanges(this.#dataRoot, conversationScope, appliedChangeSchema).find(
        (candidate) => candidate.id === existing.changeId,
      )
      if (change === undefined) throw new ApplicationNotPendingError(pieceId, applicationId)
      return { entryId: existing.id, change: change.content }
    }

    const { pending, actionId } = operation
    const target = this.#readTargetText(workspaceDir, pieceId, roomScope.surface)
    if (target !== pending.replacement) {
      this.#finish(roomScope, actionId, 'failed')
      throw new ApplicationDocumentNotSavedError(pieceId, applicationId)
    }

    const application: ApplicationEntry = {
      id: pending.applicationId,
      kind: 'application',
      responseId: pending.responseId,
      changeId: pending.change.id,
      constraint: pending.constraint,
    }
    try {
      await writeApplication(this.#dataRoot, conversationScope, conversationId, this.#entries, pending.change, application)
    } catch (err) {
      this.#finish(roomScope, actionId, 'failed')
      throw err
    }
    this.#emit(pieceId, {
      type: 'entry.appended',
      data: { actionId, entry: { ...application, change: pending.change.content }, surface: roomScope.surface },
    })
    this.#finish(roomScope, actionId, 'settled')
    return { entryId: application.id, change: pending.change.content }
  }

  /** The document Apply targets, read as it stands persisted — never the client's in-memory copy. */
  #readTargetText(workspaceDir: string, pieceId: string, surface: RoomScope['surface']): string {
    if (surface === 'draft') return readPiece(workspaceDir, pieceId)?.draft?.text ?? ''
    if (surface === 'storyContext') return readStoryContext(workspaceDir, pieceId) ?? ''
    return readAuthorContext(this.#dataRoot) ?? ''
  }
}
