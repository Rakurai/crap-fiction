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
import { durableContextSchema, type DurableContext } from '../../shared/durableContext.js'
import { ConversationNotFoundError, PieceNotFoundError } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import {
  readConversation,
  readPiece,
  readStoryContext,
  TolerantReadError,
  writeAppliedChange,
  writeConversation,
  writePieceCast,
  writeStoryContext,
} from '../store/index.js'
import {
  conversationSchema,
  substantiveResponse,
  type Conversation,
  type RespondingTo,
  type RoundParticipantRecord,
  type RoundRecord,
} from '../../shared/conversationViews.js'
import type {
  ParticipantSettledEvent,
  ParticipantStateEvent,
  RoomErrorEvent,
  RoomFailureCode,
  RoundClosedEvent,
  RoundOpenedEvent,
  RoundSnapshot,
} from '../../shared/roundEvents.js'
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
  type SpecialistCriteria,
} from './context.js'
import type { AuthorContextStore, CompiledDurableContext, ReadDurableContext } from './durableContext.js'
import { callParticipant, evidenceFrom, type AskContext, type RoundPlan, type RoundResult } from './round.js'
import type { RoomRoster } from './roster.js'

export type RoomEvent =
  | { readonly type: 'round.opened'; readonly data: RoundOpenedEvent }
  | { readonly type: 'participant.state'; readonly data: ParticipantStateEvent }
  | { readonly type: 'participant.settled'; readonly data: ParticipantSettledEvent }
  | { readonly type: 'round.closed'; readonly data: RoundClosedEvent }
  | { readonly type: 'error'; readonly data: RoomErrorEvent }

export class RoomBusyError extends Error {
  constructor(pieceId: string) {
    super(`an operation is already in flight for "${pieceId}"`)
    this.name = 'RoomBusyError'
  }
}

export class RecommendationNotFoundError extends Error {
  constructor(pieceId: string, roundId: string, participantId: string) {
    super(`no applicable suggestion from "${participantId}" in round "${roundId}" of piece "${pieceId}"`)
    this.name = 'RecommendationNotFoundError'
  }
}

export class CommentaryNotFoundError extends Error {
  constructor(pieceId: string, roundId: string, participantId: string) {
    super(`no commentary from "${participantId}" in round "${roundId}" of piece "${pieceId}"`)
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
  return err instanceof Error ? err.message : 'the round stopped for a reason the studio cannot name'
}

function findRecommendation(conversation: Conversation, roundId: string, participantId: string) {
  const round = conversation.rounds.find((candidate) => candidate.id === roundId)
  const record = round?.participants.find((candidate) => candidate.participantId === participantId)
  if (record === undefined) return undefined
  const response = substantiveResponse(record.result)
  return response?.outcome === 'applicableSuggestion' ? response : undefined
}

function findCommentary(conversation: Conversation, roundId: string, participantId: string) {
  const round = conversation.rounds.find((candidate) => candidate.id === roundId)
  const record = round?.participants.find((candidate) => candidate.participantId === participantId)
  if (record === undefined) return undefined
  const response = substantiveResponse(record.result)
  return response?.outcome === 'commentary' ? response : undefined
}

export type RoundOpening =
  | Readonly<{ kind: 'targeted'; target: string }>
  | Readonly<{ kind: 'ask'; respondingTo: RespondingTo; clarification: string | undefined }>

type ActiveRound = {
  readonly kind: 'round'
  readonly pieceId: string
  readonly conversationId: string
  readonly roundId: string
  readonly message: string | undefined
  readonly participants: readonly string[]
  readonly brought: readonly string[]
  readonly states: Map<string, 'preparing' | 'working'>
  readonly settled: RoundParticipantRecord[]
  readonly controller: AbortController
  readonly openedAt: number
  readonly ask: AskContext | undefined
}

type RunningRound = ActiveRound & {
  readonly settlement: Promise<void>
}

type ActiveApply = {
  readonly kind: 'apply'
  readonly pieceId: string
  readonly controller: AbortController
}

// Capture is not part of this union: it shares the model seam with a round and an application but
// owns its own activity and abandonment identity, so it never occupies `#operation` and is never
// reachable from `abandon()`.
type ActiveCapture = {
  readonly pieceId: string
  readonly conversationId: string
  readonly controller: AbortController
  readonly openedAt: number
}

type ActiveOperation = RunningRound | ActiveApply

export class Room {
  readonly #modelAccess: ModelAccess
  readonly #readDurableContext: ReadDurableContext
  readonly #authorContextStore: AuthorContextStore
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
    roster: RoomRoster,
    charter: Charter,
    policy: HistoryPolicy,
    logger: Logger,
    now: Clock,
  ) {
    this.#modelAccess = modelAccess
    this.#readDurableContext = readDurableContext
    this.#authorContextStore = authorContextStore
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

  snapshot(pieceId: string): RoundSnapshot | undefined {
    const operation = this.#operationFor(pieceId)
    if (operation === undefined || operation.kind !== 'round') return undefined
    return {
      conversationId: operation.conversationId,
      roundId: operation.roundId,
      message: operation.message,
      participants: operation.participants,
      brought: operation.brought,
      states: Object.fromEntries(operation.states),
      settled: [...operation.settled],
      openedAt: operation.openedAt,
      respondingTo: operation.ask?.respondingTo,
      clarification: operation.ask?.clarification,
    }
  }

  captureSnapshot(pieceId: string): CaptureSnapshot | undefined {
    const capture = this.#captures.get(pieceId)
    return capture === undefined ? undefined : { conversationId: capture.conversationId, openedAt: capture.openedAt }
  }

  async startRound(
    workspaceDir: string,
    pieceId: string,
    conversationId: string,
    message: string | undefined,
    draft: string,
    opening?: RoundOpening,
  ): Promise<{ conversationId: string; roundId: string }> {
    const holder = this.#operation
    if (holder !== undefined) throw new RoomBusyError(holder.pieceId)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const roster = [...this.#specialists, this.#storyEditor]

    let addressedIds: readonly string[]
    let ask: AskContext | undefined

    if (opening === undefined) {
      addressedIds = message === undefined ? [] : parseAddressing(message, roster).map((role) => role.id)
      ask = undefined
    } else if (opening.kind === 'targeted') {
      if (!roster.some((role) => role.id === opening.target)) throw new ParticipantNotFoundError(pieceId, opening.target)
      addressedIds = [opening.target]
      ask = undefined
    } else {
      const conversation = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)
      if (conversation === undefined) throw new ConversationNotFoundError(pieceId, conversationId)
      const { roundId: respondingToRoundId, participantId: respondingToParticipantId } = opening.respondingTo
      const commentary = findCommentary(conversation, respondingToRoundId, respondingToParticipantId)
      if (commentary === undefined) throw new CommentaryNotFoundError(pieceId, respondingToRoundId, respondingToParticipantId)
      addressedIds = [respondingToParticipantId]
      ask = { claim: commentary.claim, note: commentary.note, clarification: opening.clarification, respondingTo: opening.respondingTo }
    }

    const eligibleSpecialists =
      addressedIds.length === 0
        ? this.#specialists.filter((role) => piece.metadata.cast.includes(role.id))
        : this.#specialists.filter((role) => addressedIds.includes(role.id))

    const brought = addressedIds.length === 0 ? [] : eligibleSpecialists.map((role) => role.id).filter((id) => !piece.metadata.cast.includes(id))
    if (brought.length > 0) {
      await writePieceCast(workspaceDir, pieceId, [...piece.metadata.cast, ...brought])
    }

    const storyEditorIncluded = addressedIds.length === 0 || addressedIds.includes(this.#storyEditor.id)

    const roundId = nanoid()
    const plan: RoundPlan = {
      roundId,
      message,
      addressedIds,
      brought,
      specialists: eligibleSpecialists,
      storyEditor: storyEditorIncluded ? this.#storyEditor : undefined,
      ask,
    }
    const participants = [...eligibleSpecialists.map((role) => role.id), ...(storyEditorIncluded ? [this.#storyEditor.id] : [])]

    const openedAt = this.#now()
    const round: ActiveRound = {
      kind: 'round',
      pieceId,
      conversationId,
      roundId,
      message,
      participants,
      brought,
      states: new Map(),
      settled: [],
      controller: new AbortController(),
      openedAt,
      ask,
    }
    this.#emit(pieceId, {
      type: 'round.opened',
      data: { conversationId, roundId, message, participants, brought, openedAt, respondingTo: ask?.respondingTo, clarification: ask?.clarification },
    })
    this.#logger.info({ pieceId, conversationId, roundId, participants, brought }, 'round opened')

    const settlement = this.#run(workspaceDir, pieceId, conversationId, plan, draft, round)
      .catch((err: unknown) => {
        this.#fail(pieceId, roundId, 'UNEXPECTED_FAILURE', failureText(err), err)
      })
      .finally(() => {
        this.#operation = undefined
      })
    this.#operation = { ...round, settlement }

    return { conversationId, roundId }
  }

  settlement(pieceId: string): Promise<void> | undefined {
    const operation = this.#operationFor(pieceId)
    return operation?.kind === 'round' ? operation.settlement : undefined
  }

  // Targets the round/apply operation only — a capture in flight has its own identity and is
  // never reachable from here.
  abandon(pieceId: string): void {
    this.#operationFor(pieceId)?.controller.abort()
  }

  async apply(
    workspaceDir: string,
    pieceId: string,
    conversationId: string,
    roundId: string,
    participantId: string,
    constraint: string | undefined,
    draft: string,
  ): Promise<CallResult<{ manuscript: string; change: AppliedChange | undefined }>> {
    const holder = this.#operation
    if (holder !== undefined) throw new RoomBusyError(holder.pieceId)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const conversation = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)
    if (conversation === undefined) throw new ConversationNotFoundError(pieceId, conversationId)

    const recommendation = findRecommendation(conversation, roundId, participantId)
    if (recommendation === undefined) throw new RecommendationNotFoundError(pieceId, roundId, participantId)

    const durableContext = this.#readDurableContext(workspaceDir, pieceId)

    const controller = new AbortController()
    this.#operation = { kind: 'apply', pieceId, controller }

    try {
      const context = compileApplyContext({
        recommendationClaim: recommendation.claim,
        recommendationNote: recommendation.note,
        constraint,
        authorContext: durableContext.authorContext,
        storyContext: durableContext.storyContext,
        draft,
        conversation,
        throughRoundId: roundId,
      })
      const prompt = renderApplyPrompt(context, this.#charter)
      const result = await this.#modelAccess.call('apply', prompt, applyResultSchema, controller.signal)
      if (result.outcome !== 'value') return result

      const { manuscript } = result.value
      if (manuscript === draft) return { outcome: 'value', value: { manuscript, change: undefined } }

      const change: AppliedChange = { id: nanoid(), roundId, participantId, content: computeAppliedChangeContent(draft, manuscript) }
      await writeAppliedChange(workspaceDir, pieceId, change)
      return { outcome: 'value', value: { manuscript, change } }
    } finally {
      this.#operation = undefined
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

    const conversation = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)
    const durableContext = this.#readDurableContext(workspaceDir, pieceId)

    const controller = new AbortController()
    this.#captures.set(pieceId, { pieceId, conversationId, controller, openedAt: this.#now() })

    try {
      const context = compileCaptureContext({
        authorContext: durableContext.authorContext,
        storyContext: durableContext.storyContext,
        draft,
        conversation,
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

  #fail(pieceId: string, roundId: string, code: RoomFailureCode, message: string, cause: unknown): void {
    this.#logger.error({ pieceId, roundId, code, err: cause }, 'round failed')
    this.#emit(pieceId, { type: 'error', data: { code, message } })
    this.#emit(pieceId, { type: 'round.closed', data: { roundId, outcome: 'failed' } })
  }

  async #run(
    workspaceDir: string,
    pieceId: string,
    conversationId: string,
    plan: RoundPlan,
    draft: string,
    operation: ActiveRound,
  ): Promise<void> {
    let existing: Conversation | undefined
    try {
      existing = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)
    } catch (err) {
      if (err instanceof TolerantReadError) {
        this.#fail(pieceId, plan.roundId, 'CONVERSATION_UNREADABLE', err.message, err)
        return
      }
      throw err
    }

    let durableContext: CompiledDurableContext
    try {
      durableContext = this.#readDurableContext(workspaceDir, pieceId)
    } catch (err) {
      if (err instanceof TolerantReadError) {
        this.#fail(pieceId, plan.roundId, 'CONTEXT_UNREADABLE', err.message, err)
        return
      }
      throw err
    }

    const result: RoundResult = await this.#runRound(pieceId, plan, draft, durableContext, existing, operation)

    const record: RoundRecord = {
      id: plan.roundId,
      message: plan.message,
      addressed: plan.addressedIds,
      brought: plan.brought,
      respondingTo: plan.ask?.respondingTo,
      clarification: plan.ask?.clarification,
      participants: result.participants,
      outcome: result.outcome,
    }
    try {
      await writeConversation(workspaceDir, pieceId, conversationId, {
        id: conversationId,
        rounds: [...(existing?.rounds ?? []), record],
      })
    } catch (err) {
      this.#fail(
        pieceId,
        plan.roundId,
        'CONVERSATION_NOT_WRITTEN',
        err instanceof Error ? err.message : 'the conversation could not be written',
        err,
      )
      return
    }

    this.#emit(pieceId, { type: 'round.closed', data: { roundId: plan.roundId, outcome: result.outcome } })
    this.#logger.info({ pieceId, roundId: plan.roundId, outcome: result.outcome }, 'round closed')
  }

  async #runRound(
    pieceId: string,
    plan: RoundPlan,
    draft: string,
    durableContext: CompiledDurableContext,
    conversation: Conversation | undefined,
    operation: ActiveRound,
  ): Promise<RoundResult> {
    const signal = operation.controller.signal
    const shared = {
      message: plan.message,
      ask: plan.ask,
      authorContext: durableContext.authorContext,
      storyContext: durableContext.storyContext,
      draft,
      conversation,
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
      this.#emit(pieceId, { type: 'participant.state', data: { roundId: plan.roundId, participantId, state } })
    }
    const onSettled = (participantId: string, record: RoundParticipantRecord): void => {
      operation.states.delete(participantId)
      operation.settled.push(record)
      this.#emit(pieceId, { type: 'participant.settled', data: { roundId: plan.roundId, participantId, result: record.result } })
    }

    const calls = plan.specialists.map((role) => {
      const owesAnswer = plan.addressedIds.includes(role.id)
      return { role, owesAnswer, prompt: renderPrompt(compileSpecialistContext(contextFor(role, owesAnswer)), this.#charter) }
    })

    const records: RoundParticipantRecord[] = []
    let abandoned = false

    for (const call of calls) {
      if (signal.aborted) {
        abandoned = true
        break
      }

      const record = await callParticipant(call.role, call.prompt, call.owesAnswer, this.#modelAccess, signal, (state) =>
        onState(call.role.id, state),
      )
      records.push(record)
      onSettled(call.role.id, record)
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
        const owesAnswer = plan.addressedIds.includes(storyEditor.id) || evidence.length === 0
        const prompt = renderPrompt(compileStoryEditorContext(contextFor(storyEditor, owesAnswer), evidence), this.#charter)
        const record = await callParticipant(storyEditor, prompt, owesAnswer, this.#modelAccess, signal, (state) =>
          onState(storyEditor.id, state),
        )
        records.push(record)
        onSettled(storyEditor.id, record)
        if (record.result.kind === 'abandoned') abandoned = true
      }
    }

    return { participants: records, outcome: abandoned ? 'abandoned' : 'settled' }
  }
}
