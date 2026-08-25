import { nanoid } from 'nanoid'
import type { AppliedChange } from '../../shared/appliedChange.js'
import type { Clock } from '../../shared/clock.js'
import type { Logger } from '../logger.js'
import type { Charter } from '../model/charter.js'
import type { CallResult, ModelAccess } from '../model/types.js'
import { applyResultSchema } from '../../shared/applyResult.js'
import {
  captureResultSchema,
  type CaptureApproveOutcome,
  type CaptureDestination,
  type CaptureProposal,
} from '../../shared/captureProposal.js'
import type { CaptureSnapshot } from '../../shared/captureViews.js'
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
import { durableContextSchema, type DurableContext } from '../../shared/durableContext.js'
import { PieceNotFoundError } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import {
  ConversationEntryStore,
  readConversationEntries,
  readPiece,
  readStoryContext,
  TolerantReadError,
  writeAppliedChange,
  writePieceCast,
  writeStoryContext,
} from '../store/index.js'
import { computeAppliedChangeContent } from './appliedChange.js'
import { applyProposals, toCaptureProposals } from './capture.js'
import { parseAddressing } from './addressing.js'
import {
  compileApplyContext,
  compileCaptureContext,
  compileSpecialistContext,
  compileStoryEditorContext,
  renderApplyPrompt,
  renderCapturePrompt,
  renderPrompt,
  type ContextInput,
  type HistoryPolicy,
  type ParticipantEvidence,
  type SpecialistCriteria,
} from './context.js'
import type { AuthorContextStore, CompiledDurableContext, ReadDurableContext } from './durableContext.js'
import { callParticipant, evidenceFrom } from './dispatch.js'
import type { RoomRoster } from './roster.js'

export type RoomEvent =
  | { readonly type: 'action.started'; readonly data: ActionStartedEvent }
  | { readonly type: 'participant.activity'; readonly data: ParticipantActivityEvent }
  | { readonly type: 'entry.appended'; readonly data: EntryAppendedEvent }
  | { readonly type: 'action.finished'; readonly data: ActionFinishedEvent }
  | { readonly type: 'error'; readonly data: ConversationErrorEvent }

export class RoomBusyError extends Error {
  constructor(pieceId: string) {
    super(`an operation is already in flight for "${pieceId}"`)
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
  readonly pieceId: string
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
  readonly pieceId: string
  readonly conversationId: string
  readonly actionId: string
  readonly sourceEntryId: string
  readonly controller: AbortController
  readonly startedAt: number
}

type ActiveCapture = {
  readonly pieceId: string
  readonly conversationId: string
  readonly controller: AbortController
  readonly openedAt: number
}

type ActiveOperation = RunningDispatch | ActiveApply

type DispatchPlan = Readonly<{
  causeEntry: AuthorMessageEntry | ConcreteChangeRequestEntry
  message: string | undefined
  ask: { claim: string; note: string | undefined; clarification: string | undefined } | undefined
  addressedIds: readonly string[]
  eligibleSpecialists: readonly RoleDefinition[]
  storyEditorIncluded: boolean
  existingEntries: readonly ConversationEntry[]
  draft: string
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
  readonly #authorContextStore: AuthorContextStore
  readonly #entries: ConversationEntryStore
  readonly #logger: Logger
  readonly #now: Clock
  readonly #charter: Charter
  readonly #policy: HistoryPolicy
  readonly #specialists: readonly RoleDefinition[]
  readonly #storyEditor: RoleDefinition
  readonly #criteria: ReadonlyMap<string, SpecialistCriteria>
  readonly #listeners = new Map<string, Set<Listener>>()
  readonly #captures = new Map<string, ActiveCapture>()
  #operation: ActiveOperation | undefined = undefined

  constructor(
    modelAccess: ModelAccess,
    readDurableContext: ReadDurableContext,
    authorContextStore: AuthorContextStore,
    entries: ConversationEntryStore,
    roster: RoomRoster,
    charter: Charter,
    policy: HistoryPolicy,
    logger: Logger,
    now: Clock,
  ) {
    this.#modelAccess = modelAccess
    this.#readDurableContext = readDurableContext
    this.#authorContextStore = authorContextStore
    this.#entries = entries
    this.#logger = logger
    this.#now = now
    this.#charter = charter
    this.#policy = policy
    this.#specialists = roster.specialists
    this.#storyEditor = roster.storyEditor
    this.#criteria = roster.criteria
  }

  specialists(): readonly RoleDefinition[] {
    return this.#specialists
  }

  storyEditor(): RoleDefinition {
    return this.#storyEditor
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

  #operationFor(pieceId: string): ActiveOperation | undefined {
    return this.#operation?.pieceId === pieceId ? this.#operation : undefined
  }

  activitySnapshot(pieceId: string): ConversationActivitySnapshot | undefined {
    const operation = this.#operationFor(pieceId)
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

  captureSnapshot(pieceId: string): CaptureSnapshot | undefined {
    const capture = this.#captures.get(pieceId)
    return capture === undefined ? undefined : { conversationId: capture.conversationId, openedAt: capture.openedAt }
  }

  settlement(pieceId: string): Promise<void> | undefined {
    const operation = this.#operationFor(pieceId)
    return operation?.kind === 'dispatch' ? operation.settlement : undefined
  }

  abandon(pieceId: string, actionId: string): void {
    const operation = this.#operationFor(pieceId)
    if (operation === undefined || operation.actionId !== actionId) return
    operation.controller.abort()
    this.#operation = undefined
  }

  async dispatch(
    workspaceDir: string,
    pieceId: string,
    conversationId: string,
    opening: DispatchOpening,
    draft: string,
  ): Promise<{ conversationId: string; actionId: string }> {
    const holder = this.#operation
    if (holder !== undefined) throw new RoomBusyError(holder.pieceId)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const existingEntries = readConversationEntries(workspaceDir, pieceId, conversationId)?.entries ?? []
    const roster = [...this.#specialists, this.#storyEditor]

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

    const eligibleSpecialists =
      addressedIds.length === 0
        ? this.#specialists.filter((role) => piece.metadata.cast.includes(role.id))
        : this.#specialists.filter((role) => addressedIds.includes(role.id))

    const brought = addressedIds.length === 0 ? [] : eligibleSpecialists.map((role) => role.id).filter((id) => !piece.metadata.cast.includes(id))
    if (causeEntry.kind === 'authorMessage') causeEntry = { ...causeEntry, brought }

    const storyEditorIncluded = addressedIds.length === 0 || addressedIds.includes(this.#storyEditor.id)
    const audience = [...eligibleSpecialists.map((role) => role.id), ...(storyEditorIncluded ? [this.#storyEditor.id] : [])]

    const actionId = nanoid()
    const startedAt = this.#now()

    const dispatchState: ActiveDispatch = {
      kind: 'dispatch',
      pieceId,
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
      storyEditorIncluded,
      existingEntries,
      draft,
    }
    const cause = causeEntry

    const written = (async () => {
      if (brought.length > 0) await writePieceCast(workspaceDir, pieceId, [...piece.metadata.cast, ...brought])
      await this.#entries.append(workspaceDir, pieceId, conversationId, cause)
    })()

    const settlement = written
      .then(
        () => {
          this.#emit(pieceId, {
            type: 'action.started',
            data: { actionId, conversationId, kind: 'dispatch', sourceEntryId: cause.id, startedAt, audience },
          })
          this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: cause } })
          return this.#run(workspaceDir, pieceId, conversationId, plan, dispatchState).catch((err: unknown) => {
            this.#fail(pieceId, actionId, 'UNEXPECTED_FAILURE', failureText(err), err)
          })
        },
        () => {},
      )
      .finally(() => {
        if (this.#operation?.actionId === actionId) this.#operation = undefined
      })
    this.#operation = { ...dispatchState, settlement }

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
    pieceId: string,
    conversationId: string,
    plan: DispatchPlan,
    operation: ActiveDispatch,
  ): Promise<void> {
    const { causeEntry, message, ask, addressedIds, eligibleSpecialists, storyEditorIncluded, existingEntries, draft } = plan
    const { actionId, controller } = operation
    const signal = controller.signal

    let durableContext: CompiledDurableContext
    try {
      durableContext = this.#readDurableContext(workspaceDir, pieceId)
    } catch (err) {
      if (err instanceof TolerantReadError) {
        this.#fail(pieceId, actionId, 'CONTEXT_UNREADABLE', err.message, err)
        return
      }
      throw err
    }

    const shared = {
      message,
      ask,
      authorContext: durableContext.authorContext,
      storyContext: durableContext.storyContext,
      draft,
      entries: existingEntries,
      policy: this.#policy,
    }
    const contextFor = (role: RoleDefinition, owesAnswer: boolean): ContextInput => ({
      ...shared,
      role,
      criteria: this.#criteria.get(role.id),
      owesAnswer,
    })

    const onState = (participantId: string, state: 'preparing' | 'working'): void => {
      operation.states.set(participantId, state)
      this.#emit(pieceId, { type: 'participant.activity', data: { actionId, participantId, state } })
    }

    const calls = eligibleSpecialists.map((role) => {
      const owesAnswer = addressedIds.includes(role.id)
      return { role, owesAnswer, prompt: renderPrompt(compileSpecialistContext(contextFor(role, owesAnswer)), this.#charter) }
    })

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
        await this.#entries.append(workspaceDir, pieceId, conversationId, outcome.entry)
      } catch (err) {
        reportFailureOnce(err instanceof Error ? err.message : 'the entry could not be written', err)
        return
      }
      this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: outcome.entry } })

      const gathered = evidenceFrom(outcome, call.role.id)
      if (gathered !== undefined) evidence.push(gathered)
    }

    await Promise.all(calls.map(settleSpecialist))

    if (!abandoned && !failed && storyEditorIncluded) {
      if (signal.aborted) {
        abandoned = true
      } else {
        const owesAnswer = addressedIds.includes(this.#storyEditor.id) || evidence.length === 0
        const prompt = renderPrompt(compileStoryEditorContext(contextFor(this.#storyEditor, owesAnswer), evidence), this.#charter)
        const outcome = await callParticipant(this.#storyEditor, prompt, causeEntry.id, owesAnswer, this.#modelAccess, signal, (state) =>
          onState(this.#storyEditor.id, state),
        )
        operation.states.delete(this.#storyEditor.id)
        if (outcome.kind === 'abandoned') {
          abandoned = true
        } else {
          try {
            await this.#entries.append(workspaceDir, pieceId, conversationId, outcome.entry)
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
    pieceId: string,
    conversationId: string,
    responseId: string,
    constraint: string | undefined,
    draft: string,
  ): Promise<{ actionId: string; result: CallResult<{ manuscript: string; change: AppliedChange | undefined; entryId: string | undefined }> }> {
    const holder = this.#operation
    if (holder !== undefined) throw new RoomBusyError(holder.pieceId)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const entries = readConversationEntries(workspaceDir, pieceId, conversationId)?.entries ?? []
    const response = findResponse(entries, responseId)
    if (response === undefined || response.outcome !== 'applicableSuggestion') throw new RecommendationNotFoundError(pieceId, responseId)

    const durableContext = this.#readDurableContext(workspaceDir, pieceId)

    const actionId = nanoid()
    const controller = new AbortController()
    this.#operation = { kind: 'apply', pieceId, conversationId, actionId, sourceEntryId: responseId, controller, startedAt: this.#now() }
    this.#emit(pieceId, {
      type: 'action.started',
      data: { actionId, conversationId, kind: 'apply', sourceEntryId: responseId, startedAt: this.#operation.startedAt },
    })

    try {
      const context = compileApplyContext({
        recommendationClaim: response.claim,
        recommendationNote: response.note,
        constraint,
        authorContext: durableContext.authorContext,
        storyContext: durableContext.storyContext,
        draft,
        entries,
      })
      const prompt = renderApplyPrompt(context, this.#charter)
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
      await writeAppliedChange(workspaceDir, pieceId, change)
      const application: ApplicationEntry = { id: nanoid(), kind: 'application', responseId, changeId, constraint }
      await this.#entries.append(workspaceDir, pieceId, conversationId, application)
      this.#emit(pieceId, { type: 'entry.appended', data: { actionId, entry: { ...application, change: change.content } } })
      this.#emit(pieceId, { type: 'action.finished', data: { actionId, outcome: 'settled' } })
      return { actionId, result: { outcome: 'value', value: { manuscript, change, entryId: application.id } } }
    } finally {
      if (this.#operation?.actionId === actionId) this.#operation = undefined
    }
  }

  async capture(
    workspaceDir: string,
    pieceId: string,
    conversationId: string,
    draft: string,
  ): Promise<CallResult<{ proposals: readonly CaptureProposal[] }>> {
    if (this.#captures.has(pieceId)) throw new RoomBusyError(pieceId)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const entries = readConversationEntries(workspaceDir, pieceId, conversationId)?.entries
    const durableContext = this.#readDurableContext(workspaceDir, pieceId)

    const controller = new AbortController()
    this.#captures.set(pieceId, { pieceId, conversationId, controller, openedAt: this.#now() })

    try {
      const context = compileCaptureContext({
        authorContext: durableContext.authorContext,
        storyContext: durableContext.storyContext,
        draft,
        entries,
      })
      const prompt = renderCapturePrompt(context)
      const result = await this.#modelAccess.call('capture', prompt, captureResultSchema, controller.signal)
      if (result.outcome !== 'value') return result

      return { outcome: 'value', value: { proposals: toCaptureProposals(result.value.proposals) } }
    } finally {
      this.#captures.delete(pieceId)
    }
  }

  async approveCapture(workspaceDir: string, pieceId: string, approved: readonly CaptureProposal[]): Promise<CaptureApproveOutcome> {
    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const byDestination = new Map<CaptureDestination, CaptureProposal[]>()
    for (const proposal of approved) {
      const forDestination = byDestination.get(proposal.destination)
      if (forDestination === undefined) byDestination.set(proposal.destination, [proposal])
      else forDestination.push(proposal)
    }

    const written: CaptureDestination[] = []
    const failures: { destination: CaptureDestination; message: string }[] = []

    for (const destination of ['authorContext', 'storyContext'] as const) {
      const proposals = byDestination.get(destination)
      if (proposals === undefined) continue

      try {
        if (destination === 'authorContext') {
          const next = applyProposals(this.#authorContextStore.read(), proposals)
          await this.#authorContextStore.write(next)
        } else {
          const current: DurableContext = readStoryContext(workspaceDir, pieceId, durableContextSchema) ?? {}
          await writeStoryContext(workspaceDir, pieceId, applyProposals(current, proposals))
        }
        written.push(destination)
      } catch (err) {
        failures.push({ destination, message: err instanceof Error ? err.message : 'the write failed' })
      }
    }

    return { written, failures }
  }
}
