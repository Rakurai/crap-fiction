import { nanoid } from 'nanoid'
import type { AppliedChange } from '../../shared/appliedChange.js'
import type { Clock } from '../../shared/clock.js'
import type { Logger } from '../logger.js'
import type { Charter } from '../model/charter.js'
import type { CallResult, ModelAccess } from '../model/types.js'
import { applyResultSchema } from '../../shared/applyResult.js'
import { ConversationNotFoundError, PieceNotFoundError } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import { readConversation, readPiece, TolerantReadError, writeAppliedChange, writeConversation, writePieceCast } from '../store/index.js'
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
import { parseAddressing } from './addressing.js'
import {
  compileApplyContext,
  compileSpecialistContext,
  compileStoryEditorContext,
  renderApplyPrompt,
  renderPrompt,
  type ContextInput,
  type HistoryPolicy,
  type SpecialistCriteria,
} from './context.js'
import type { CompiledDurableContext, ReadDurableContext } from './durableContext.js'
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
    super(`a round is already in flight for "${pieceId}"`)
    this.name = 'RoomBusyError'
  }
}

/** No applicable suggestion stands at the named place — a stale identity, or an outcome that was never one. */
export class RecommendationNotFoundError extends Error {
  constructor(pieceId: string, roundId: string, participantId: string) {
    super(`no applicable suggestion from "${participantId}" in round "${roundId}" of piece "${pieceId}"`)
    this.name = 'RecommendationNotFoundError'
  }
}

/** No commentary stands at the named place — a stale identity, or an outcome that was never one to ask a concrete change about. */
export class CommentaryNotFoundError extends Error {
  constructor(pieceId: string, roundId: string, participantId: string) {
    super(`no commentary from "${participantId}" in round "${roundId}" of piece "${pieceId}"`)
    this.name = 'CommentaryNotFoundError'
  }
}

/** A round the author opened by an act — replying to a response — named a participant the room does not have. */
export class ParticipantNotFoundError extends Error {
  constructor(pieceId: string, participantId: string) {
    super(`no participant "${participantId}" in the room for piece "${pieceId}"`)
    this.name = 'ParticipantNotFoundError'
  }
}

type Listener = (event: RoomEvent) => void

/**
 * What the author is told when the round failed rather than a participant's call
 * failing. The fallback names the room's own ignorance rather than guessing at a
 * cause: something that is not an `Error` reached a catch, and a sentence
 * inventing why would be worse than one admitting nothing is known.
 */
function failureText(err: unknown): string {
  return err instanceof Error ? err.message : 'the round stopped for a reason the studio cannot name'
}

/** The applicable suggestion the author named, or `undefined` — a stale identity, or a response that never was one. */
function findRecommendation(conversation: Conversation, roundId: string, participantId: string) {
  const round = conversation.rounds.find((candidate) => candidate.id === roundId)
  const record = round?.participants.find((candidate) => candidate.participantId === participantId)
  if (record === undefined) return undefined
  const response = substantiveResponse(record.result)
  return response?.outcome === 'applicableSuggestion' ? response : undefined
}

/**
 * The commentary the author is asking a concrete change about, or `undefined`
 * — a stale identity, or a response that was never a reading without an action
 * (UX_DESIGN "Actions on a response": asking is offered only there — an
 * applicable suggestion already names one).
 */
function findCommentary(conversation: Conversation, roundId: string, participantId: string) {
  const round = conversation.rounds.find((candidate) => candidate.id === roundId)
  const record = round?.participants.find((candidate) => candidate.participantId === participantId)
  if (record === undefined) return undefined
  const response = substantiveResponse(record.result)
  return response?.outcome === 'commentary' ? response : undefined
}

/**
 * What `startRound` takes beyond the author's own message, for the two rounds
 * SPEC "The round" has addressed by the act rather than by the words: replying
 * to a response names a participant directly, and asking one for a concrete
 * change names the response it is asking about instead of carrying a message
 * at all. Absent, the message (if any) is read for addressing the ordinary way.
 */
export type RoundOpening =
  | Readonly<{ kind: 'targeted'; target: string }>
  | Readonly<{ kind: 'ask'; respondingTo: RespondingTo; clarification: string | undefined }>

/** A round under way, as the room tracks it while it runs. */
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
  /** Stamped once, where the round opens, so the event and the snapshot agree. */
  readonly openedAt: number
  /** Present exactly where this round is asking its one participant for a concrete change. */
  readonly ask: AskContext | undefined
}

type RunningRound = ActiveRound & {
  /**
   * The round's own completion, held by the object that represents the round: a
   * round outlives the request that opened it, so a caller that needs to know it
   * is over can await this instead of watching for its absence. It settles rather
   * than rejects however the round ended — the room handles its own failure — so
   * awaiting it is never itself a way to be handed an unowned rejection.
   */
  readonly settlement: Promise<void>
}

/**
 * An application under way. Unlike a round it outlives nothing — the request
 * that started it is the request that reads its result — so there is no
 * settlement to hold and nothing to snapshot: a client that reloaded mid-call
 * has no `applying` state to restore, only the request it is already waiting
 * on.
 */
type ActiveApply = {
  readonly kind: 'apply'
  readonly pieceId: string
  readonly controller: AbortController
}

/**
 * SPEC "Operation state": one author-initiated model operation at a time,
 * whichever kind it is — the lock is the room's single `#operation` field
 * regardless, and only a round has more to say about itself while it runs.
 */
type ActiveOperation = RunningRound | ActiveApply

/**
 * SPEC "Seams": the room boundary owns the operations the author starts —
 * start one, abandon the current one, subscribe to its events. SPEC
 * "Operation state": one round is in flight per piece at a time; a second
 * start is refused rather than queued.
 */
export class Room {
  readonly #modelAccess: ModelAccess
  readonly #readDurableContext: ReadDurableContext
  readonly #logger: Logger
  readonly #now: Clock
  readonly #charter: Charter
  readonly #policy: HistoryPolicy
  readonly #specialists: readonly RoleDefinition[]
  readonly #storyEditor: RoleDefinition
  readonly #criteria: ReadonlyMap<string, SpecialistCriteria>
  readonly #listeners = new Map<string, Set<Listener>>()
  /**
   * SPEC "Model access": there is no scheduler, and no runtime is ever asked to
   * hold more than one call. The room is one object for the whole studio, so
   * that bound is the room's to keep rather than each piece's — two pieces open
   * at once would otherwise issue concurrent calls against the single local
   * model. Hence one operation and not a map: the piece it belongs to is a
   * field on it, so that a snapshot or an abandon naming a different piece
   * finds nothing rather than reaching this one.
   */
  #operation: ActiveOperation | undefined = undefined

  constructor(
    modelAccess: ModelAccess,
    readDurableContext: ReadDurableContext,
    roster: RoomRoster,
    charter: Charter,
    policy: HistoryPolicy,
    logger: Logger,
    now: Clock,
  ) {
    this.#modelAccess = modelAccess
    this.#readDurableContext = readDurableContext
    this.#logger = logger
    this.#now = now
    this.#charter = charter
    this.#policy = policy
    this.#specialists = roster.specialists
    this.#storyEditor = roster.storyEditor
    this.#criteria = roster.criteria
  }

  /**
   * The room's own roster, for the one surface outside a round that needs to
   * name who could ever be in it (#13: listing a piece's specialists to enable
   * or disable them). The Story Editor is never part of this — CONTEXT "Room":
   * "the Story Editor is always present and is not one of them".
   */
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

  /**
   * SPEC "The room is the only parser, and a round that names its target is not
   * parsed at all": `opening` absent reads the ordinary way — addressing is
   * parsed out of `message`, and is the only thing it is parsed for. `opening`
   * present is a round the author opened from a particular response — replying
   * to it, addressed to that participant by the act rather than by the words
   * (`message` still carries the author's own text verbatim, sent rather than
   * parsed), or asking it for a concrete change, which carries no message at
   * all and resolves the response being asked about here, once, so nothing
   * downstream reads the conversation a second time to find it. Addressing a
   * specialist that is not enabled enables it — the same durable write to
   * `piece.yaml` as enabling it directly — before the round opens, on the same
   * terms whichever way the round was addressed.
   *
   * `message` is optional because a round can be opened by an act rather than
   * by something the author typed, and CONTEXT "Round" keeps the record honest
   * about which it was rather than composing words on the author's behalf.
   * There is then nothing to read for addressing, so nothing is read.
   */
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

    // The round is under way before there is a promise to represent it, so the
    // operation is completed rather than mutated: the states map and the settled
    // list are the same objects the running round writes into, so what a
    // snapshot reads is the round's own progress and not a copy of its start.
    // Clearing the operation is what frees the room, so it happens whichever way
    // the round ended.
    //
    // The rejection handler is what makes the round owned rather than floating
    // (CODING_STANDARDS "Async work and cancellation"). The round is the room's
    // own operation and nothing above the room can act on its collapse — the
    // request that opened it was answered long before — so the room is the seam
    // that handles it: it states the failure to whoever is watching the piece,
    // and the settlement resolves rather than rejects, so a caller holding it is
    // told the round is over and not handed a second unowned rejection.
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

  /**
   * The round in flight for a piece, as something to wait on. A round settles
   * after the request that opened it has already been answered, so a caller that
   * needs the round finished — rather than merely started — has nothing else to
   * hold; watching for the round's absence would be a polling loop.
   */
  settlement(pieceId: string): Promise<void> | undefined {
    const operation = this.#operationFor(pieceId)
    return operation?.kind === 'round' ? operation.settlement : undefined
  }

  abandon(pieceId: string): void {
    this.#operationFor(pieceId)?.controller.abort()
  }

  /**
   * CONTEXT "Apply"/SPEC "Applying a recommendation": one call, its result
   * reached by the request that asked for it — there is no round to open and
   * no participant is called, so nothing here touches the room's own event
   * stream. The manuscript's read-only lock is this method's own duration:
   * held from the moment the operation is claimed to the `finally` that
   * releases it, whichever way the call ends.
   *
   * Everything the call is compiled from is read before the lock is taken —
   * a piece, a conversation or a recommendation this method cannot find is a
   * refusal that never touches `#operation`, on the same terms `startRound`
   * refuses before touching it.
   *
   * CONTEXT "Applied change": a settled call that actually changed the
   * manuscript is also the one place that change is computed and persisted —
   * from the manuscript states either side, never from anything a
   * participant returned. A call whose manuscript came back identical to the
   * draft it started from has nothing to keep a record of.
   */
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

  /**
   * A failure of the room's own, rather than of a participant's call. Both
   * events go out and in this order: the code is the notice the author is shown,
   * and the close is what stops the round being drawn as still running (SPEC
   * "Operation state"). Emitting one without the other is how a round becomes
   * permanently in flight in the client's projection.
   *
   * This is also the one place the room logs a failure, so the log and the notice
   * cannot disagree about what happened. `cause` is carried for the log alone —
   * the author reads `message`, and a stack trace is a diagnostic fact that
   * belongs to stderr.
   */
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
      // A conversation file the store cannot read is the one failure the round
      // meets before it has done anything, and it is the author's to act on —
      // the round never opens against a record the studio would then overwrite.
      if (err instanceof TolerantReadError) {
        this.#fail(pieceId, plan.roundId, 'CONVERSATION_UNREADABLE', err.message, err)
        return
      }
      throw err
    }

    // Both durable contexts, read before the round's first prompt is compiled
    // (SPEC "Files"). A hand-edited file the store refuses is the author's to
    // act on and is stated in the same breath as an unreadable conversation:
    // running the round without it would put every participant to work without
    // the standing instructions they are supposed to answer from, and say
    // nothing about it.
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

    // Nothing is caught around the round itself. Every outcome a participant call
    // can have is already a record the round returns, so anything thrown here is
    // something the room has no vocabulary for — and the handler on this
    // promise's own settlement is what owns it, closing the round and naming the
    // failure once, rather than each throwing site doing half of that.
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
      // The round happened and cannot be un-happened, but it is not on disk, so
      // the author is told rather than left to discover on the next reload that
      // the exchange they just read is gone. The close carries `failed` for the
      // same reason: what settled did not become part of the record.
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

  /**
   * SPEC "The round": compiles every eligible specialist's context before any
   * call is issued, calls them one at a time in the cast's order, then — where
   * the round will reach it — compiles and calls the Story Editor over what
   * settled. Abandonment stops the round at the call in flight: calls not yet
   * issued are never issued and never appear in the result, and no Story Editor
   * call is attempted.
   *
   * Every one of those promises is announced or observed at the room's own event
   * stream: `round.opened` carries the roster in the order the round will call
   * it, each `participant.settled` lands in the order the calls settled, and
   * `round.closed` carries the outcome. That is why the loop is private — the
   * interface a caller has already states everything it does.
   */
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

    // Every specialist's prompt, complete, before the first call goes out. The
    // list is built rather than a map keyed by id so that iterating it needs no
    // lookup and therefore no branch for a lookup that missed — a `continue` on
    // an absent prompt would silently drop a specialist from the round.
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
        // Addressed directly, it owes an answer for the ordinary reason. With no
        // readings to weigh it owes one too: SPEC "The round" has the round that
        // produced no answer saying so, and a Story Editor free to return no
        // comment on a quiet round would leave the author with a round that
        // reported nothing and explained nothing.
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
