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
  type RoomActivitySnapshot,
} from '../../shared/conversationEvents.js'
import type { DocumentSnapshot, SurfaceId } from '../../shared/surfaces.js'
import { PieceNotFoundError } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import { conversationScopeFor, roomScopeKey, type ConversationScope, type RoomScope } from '../scope.js'
import {
  ConversationEntryStore,
  readAppliedChanges,
  readAuthorContext,
  readConversationEntries,
  readPiece,
  readStoryContext,
  writeApplication,
  writePieceCast,
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

export class ApplicationNotPendingError extends Error {
  constructor(pieceId: string, applicationId: string) {
    super(`no pending or committed application "${applicationId}" for piece "${pieceId}"`)
    this.name = 'ApplicationNotPendingError'
  }
}

export class ApplicationDocumentNotSavedError extends Error {
  constructor(pieceId: string, applicationId: string) {
    super(`application "${applicationId}" for piece "${pieceId}" does not match the document as saved`)
    this.name = 'ApplicationDocumentNotSavedError'
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

/**
 * A replacement the model returned, held until the client installs, saves and confirms it.
 * `applicationId` is provisional identity: it becomes the durable application entry's id.
 */
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
  /** The reference the declared Interviewer receives on this surface, and no other participant does. */
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
   * Opens a piece as the server-authoritative transition it is: a different piece that was
   * open has its unfinished work abandoned, across all three of its room scopes, before this
   * piece becomes current; reconnecting to the piece already open resumes it untouched.
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
    this.#operations.delete(roomScopeKey(scope))
    // A pending Apply has no async work left for the abort signal to interrupt — the model call
    // already settled — so abandoning it is the only thing that will ever close out its action.
    if (operation.kind === 'apply' && operation.pending !== undefined) {
      this.#emit(scope.pieceId, { type: 'action.finished', data: { actionId, outcome: 'abandoned', surface: scope.surface } })
    }
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
    const existingEntries = readConversationEntries(this.#dataRoot, conversationScope, conversationId)?.entries ?? []
    const modeDescription = this.#catalog.mode(piece.metadata.mode).description
    const modeSpecialists = this.#catalog.specialistsFor(piece.metadata.mode, roomScope.surface)
    const roster = [...modeSpecialists, this.#catalog.roster.storyEditor, ...this.#catalog.roster.addressedOnly]

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
    const eligibleAddressedOnly = this.#catalog.roster.addressedOnly.filter((role) => addressedIds.includes(role.id))

    const brought = addressedIds.length === 0 ? [] : eligibleSpecialists.map((role) => role.id).filter((id) => !enabledCast.includes(id))
    if (causeEntry.kind === 'authorMessage') causeEntry = { ...causeEntry, brought }

    const storyEditorIncluded = addressedIds.length === 0 || addressedIds.includes(this.#catalog.roster.storyEditor.id)
    const audience = [
      ...eligibleSpecialists.map((role) => role.id),
      ...eligibleAddressedOnly.map((role) => role.id),
      ...(storyEditorIncluded ? [this.#catalog.roster.storyEditor.id] : []),
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
      documents,
      modeDescription,
      interviewerReference: this.#catalog.referenceFor(piece.metadata.mode, roomScope.surface) ?? undefined,
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
            data: { actionId, conversationId, kind: 'dispatch', sourceEntryId: cause.id, startedAt, audience, surface: roomScope.surface },
          })
          this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: cause, surface: roomScope.surface } })
          return this.#run(roomScope, conversationScope, conversationId, plan, dispatchState).catch((err: unknown) => {
            this.#fail(pieceId, roomScope.surface, actionId, 'UNEXPECTED_FAILURE', failureText(err), err)
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

  #fail(pieceId: string, surface: RoomScope['surface'], actionId: string, code: ConversationFailureCode, message: string, cause: unknown): void {
    this.#logger.error({ pieceId, actionId, code, err: cause }, 'conversation action failed')
    this.#emit(pieceId, { type: 'error', data: { code, message, surface } })
    this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'failed', surface } })
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

    const onState = (participantId: string, state: 'preparing' | 'working'): void => {
      operation.states.set(participantId, state)
      this.#emit(pieceId, { type: 'participant.activity', data: { actionId, participantId, state, surface: roomScope.surface } })
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
      this.#fail(pieceId, roomScope.surface, actionId, 'CONVERSATION_NOT_WRITTEN', message, err)
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
        const outcome = await callParticipant(storyEditor, prompt, causeEntry.id, true, this.#modelAccess, signal, (state) =>
          onState(storyEditor.id, state),
        )
        operation.states.delete(storyEditor.id)
        if (outcome.kind === 'abandoned') {
          abandoned = true
        } else {
          try {
            await this.#entries.append(this.#dataRoot, conversationScope, conversationId, outcome.entry)
          } catch (err) {
            reportFailureOnce(err instanceof Error ? err.message : 'the entry could not be written', err)
          }
          if (!failed) this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: outcome.entry, surface: roomScope.surface } })
        }
      }
    }

    if (!failed) {
      this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: abandoned ? 'abandoned' : 'settled', surface: roomScope.surface } })
      this.#logger.info({ pieceId, actionId, outcome: abandoned ? 'abandoned' : 'settled' }, 'conversation action closed')
    }
  }

  /**
   * Starts an Apply: a no-change result settles on the spot, a replacement is retained as a
   * pending application and its scope stays busy until {@link confirmApply} or {@link abandon}
   * closes it out. Model, installation, save and confirmation failures all unlock the same way —
   * only {@link confirmApply}'s own failure paths land here too, by way of the pending state this
   * method leaves behind.
   */
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
      if (this.#operations.get(key)?.actionId === actionId) this.#operations.delete(key)
      this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome, surface: roomScope.surface } })
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

  /**
   * The generated document a pending Apply is holding, by the provisional identity its own
   * `activity.snapshot` reported — what a reconnecting client resumes installation from, without
   * a further model call. Answers only while that identity is still the scope's pending Apply;
   * an already-committed application is read from the durable conversation instead.
   */
  pendingReplacement(roomScope: RoomScope, conversationId: string, applicationId: string): string {
    const operation = this.#operationFor(roomScope)
    if (operation?.kind !== 'apply' || operation.conversationId !== conversationId || operation.pending?.applicationId !== applicationId) {
      throw new ApplicationNotPendingError(roomScope.pieceId, applicationId)
    }
    return operation.pending.replacement
  }

  /**
   * Commits a pending Apply once its replacement is confirmed saved. Re-confirming an identity
   * that already committed, with its change already on file, is a no-op rather than a refusal —
   * confirmation is protocol, not a second author decision.
   */
  async confirmApply(
    workspaceDir: string,
    roomScope: RoomScope,
    conversationId: string,
    applicationId: string,
  ): Promise<{ entryId: string; change: AppliedChangeContent }> {
    const pieceId = roomScope.pieceId
    const key = roomScopeKey(roomScope)
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
      this.#operations.delete(key)
      this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'failed', surface: roomScope.surface } })
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
      // The durable write is what commits an Apply, so a failed one ends the operation rather than
      // leaving the scope holding a replacement no author can now reach or abandon.
      this.#operations.delete(key)
      this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'failed', surface: roomScope.surface } })
      throw err
    }
    this.#emit(pieceId, {
      type: 'entry.appended',
      data: { actionId, entry: { ...application, change: pending.change.content }, surface: roomScope.surface },
    })
    this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'settled', surface: roomScope.surface } })
    this.#operations.delete(key)
    return { entryId: application.id, change: pending.change.content }
  }

  /** The document Apply targets, read as it stands persisted — never the client's in-memory copy. */
  #readTargetText(workspaceDir: string, pieceId: string, surface: RoomScope['surface']): string {
    if (surface === 'draft') return readPiece(workspaceDir, pieceId)?.draft?.text ?? ''
    if (surface === 'storyContext') return readStoryContext(workspaceDir, pieceId) ?? ''
    return readAuthorContext(this.#dataRoot) ?? ''
  }
}
