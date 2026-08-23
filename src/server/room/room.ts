import { nanoid } from 'nanoid'
import type { Charter } from '../model/charter.js'
import type { ModelAccess } from '../model/modelAccess.js'
import type { ModeDescriptor } from '../modes.js'
import { PieceNotFoundError } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import { readConversation, readPiece, TolerantReadError, writeConversation, writePieceCast } from '../store/index.js'
import { conversationSchema, type Conversation, type RoundParticipantRecord, type RoundRecord } from '../../shared/conversationViews.js'
import type {
  ParticipantSettledEvent,
  ParticipantStateEvent,
  RoomErrorEvent,
  RoomFailureCode,
  RoundClosedEvent,
  RoundOpenedEvent,
  RoundSnapshot,
} from '../../shared/roundEvents.js'
import { parseAddressing } from './addressing.js'
import type { HistoryPolicy } from './context.js'
import { runRound, type RoundPlan } from './round.js'

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

type Listener = (event: RoomEvent) => void

/** A round under way, as the room tracks it while it runs. */
type ActiveRound = {
  readonly pieceId: string
  readonly conversationId: string
  readonly roundId: string
  readonly message: string | undefined
  readonly participants: readonly string[]
  readonly states: Map<string, 'preparing' | 'working'>
  readonly settled: RoundParticipantRecord[]
  readonly controller: AbortController
}

type ActiveOperation = ActiveRound & {
  /**
   * The round's own completion. A round outlives the request that opened it, so
   * without this the promise driving it would be floating; held here it belongs
   * to the object that represents the round, and a caller that needs to know the
   * round is over can await it instead of watching for its absence.
   */
  readonly settlement: Promise<void>
}

/**
 * CONTEXT "Room"/"Mode": the cast is the mode's specialists; the Story
 * Editor is always present and is not one of them. The shipped roster names
 * every participant, so whichever one the mode's cast does not name is the
 * Story Editor — resolved once, here, and a roster that does not resolve to
 * exactly one is shipped data broken in a way startup should catch rather
 * than a request discovering it mid-round.
 */
function resolveParticipants(
  mode: ModeDescriptor,
  roles: readonly RoleDefinition[],
): { specialists: readonly RoleDefinition[]; storyEditor: RoleDefinition } {
  const castIds = new Set(mode.cast.map((specialist) => specialist.id))
  const specialists = mode.cast.map((specialist) => {
    const role = roles.find((candidate) => candidate.id === specialist.id)
    if (role === undefined) {
      throw new Error(`mode "${mode.id}" names cast member "${specialist.id}" with no matching role definition`)
    }
    return role
  })
  const rest = roles.filter((role) => !castIds.has(role.id))
  if (rest.length !== 1) {
    throw new Error(`expected exactly one participant outside the mode's cast (the Story Editor), found ${rest.length}`)
  }
  const [storyEditor] = rest
  if (storyEditor === undefined) {
    throw new Error('expected exactly one participant outside the mode\'s cast (the Story Editor), found none')
  }
  return { specialists, storyEditor }
}

/**
 * SPEC "Seams": the room boundary owns the operations the author starts —
 * start one, abandon the current one, subscribe to its events. SPEC
 * "Operation state": one round is in flight per piece at a time; a second
 * start is refused rather than queued.
 */
export class Room {
  readonly #modelAccess: ModelAccess
  readonly #charter: Charter
  readonly #policy: HistoryPolicy
  readonly #specialists: readonly RoleDefinition[]
  readonly #storyEditor: RoleDefinition
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

  constructor(modelAccess: ModelAccess, roles: readonly RoleDefinition[], charter: Charter, mode: ModeDescriptor, policy: HistoryPolicy) {
    this.#modelAccess = modelAccess
    this.#charter = charter
    this.#policy = policy
    const { specialists, storyEditor } = resolveParticipants(mode, roles)
    this.#specialists = specialists
    this.#storyEditor = storyEditor
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
    if (operation === undefined) return undefined
    return {
      conversationId: operation.conversationId,
      roundId: operation.roundId,
      message: operation.message,
      participants: operation.participants,
      states: Object.fromEntries(operation.states),
      settled: [...operation.settled],
    }
  }

  /**
   * SPEC "The round": addressing is parsed out of the author's message and
   * is the only thing it is parsed for. Addressing a specialist that is not
   * enabled enables it — the same durable write to `piece.yaml` as enabling
   * it directly — before the round opens.
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
  ): Promise<{ conversationId: string; roundId: string }> {
    const holder = this.#operation
    if (holder !== undefined) throw new RoomBusyError(holder.pieceId)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const addressed = message === undefined ? [] : parseAddressing(message, [...this.#specialists, this.#storyEditor])
    const addressedIds = addressed.map((role) => role.id)

    const eligibleSpecialists =
      addressedIds.length === 0
        ? this.#specialists.filter((role) => piece.metadata.cast.includes(role.id))
        : this.#specialists.filter((role) => addressedIds.includes(role.id))

    if (addressedIds.length > 0) {
      const missing = eligibleSpecialists.map((role) => role.id).filter((id) => !piece.metadata.cast.includes(id))
      if (missing.length > 0) {
        await writePieceCast(workspaceDir, pieceId, [...piece.metadata.cast, ...missing])
      }
    }

    const storyEditorIncluded = addressedIds.length === 0 || addressedIds.includes(this.#storyEditor.id)

    const roundId = nanoid()
    const plan: RoundPlan = {
      roundId,
      message,
      addressedIds,
      specialists: eligibleSpecialists,
      storyEditor: storyEditorIncluded ? this.#storyEditor : undefined,
    }
    const participants = [...eligibleSpecialists.map((role) => role.id), ...(storyEditorIncluded ? [this.#storyEditor.id] : [])]

    const round: ActiveRound = {
      pieceId,
      conversationId,
      roundId,
      message,
      participants,
      states: new Map(),
      settled: [],
      controller: new AbortController(),
    }
    this.#emit(pieceId, { type: 'round.opened', data: { conversationId, roundId, message, participants } })

    // The round is under way before there is a promise to represent it, so the
    // operation is completed rather than mutated: the states map and the settled
    // list are the same objects the running round writes into, so what a
    // snapshot reads is the round's own progress and not a copy of its start.
    // Clearing the operation is what frees the room, so it happens whichever way
    // the round ended.
    const settlement = this.#run(workspaceDir, pieceId, conversationId, plan, draft, round).finally(() => {
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
    return this.#operationFor(pieceId)?.settlement
  }

  abandon(pieceId: string): void {
    this.#operationFor(pieceId)?.controller.abort()
  }

  /**
   * A failure of the room's own, rather than of a participant's call. Both
   * events go out and in this order: the code is the notice the author is shown,
   * and the close is what stops the round being drawn as still running (SPEC
   * "Operation state"). Emitting one without the other is how a round becomes
   * permanently in flight in the client's projection.
   */
  #fail(pieceId: string, roundId: string, code: RoomFailureCode, message: string): void {
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
        this.#fail(pieceId, plan.roundId, 'CONVERSATION_UNREADABLE', err.message)
        return
      }
      throw err
    }

    let result: Awaited<ReturnType<typeof runRound>>
    try {
      result = await runRound({
        plan,
        draft,
        authorContext: undefined,
        storyContext: undefined,
        conversation: existing,
        policy: this.#policy,
        charter: this.#charter,
        modelAccess: this.#modelAccess,
        signal: operation.controller.signal,
        callbacks: {
          onState: (participantId, state) => {
            operation.states.set(participantId, state)
            this.#emit(pieceId, { type: 'participant.state', data: { roundId: plan.roundId, participantId, state } })
          },
          onSettled: (participantId, record) => {
            operation.states.delete(participantId)
            operation.settled.push(record)
            this.#emit(pieceId, {
              type: 'participant.settled',
              data: { roundId: plan.roundId, participantId, result: record.result },
            })
          },
        },
      })
    } catch (err) {
      // Every outcome a participant call can have is already a record `runRound`
      // returns, so reaching here means something the room has no vocabulary for
      // — nothing to name to the author, and nothing to write. The round still
      // closes, because a round that stopped running and is still drawn as
      // running is a worse failure than the one that caused it, and then the
      // error propagates: this is not the room's to handle.
      this.#emit(pieceId, { type: 'round.closed', data: { roundId: plan.roundId, outcome: 'failed' } })
      throw err
    }

    const record: RoundRecord = {
      id: plan.roundId,
      message: plan.message,
      addressed: plan.addressedIds,
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
      this.#fail(pieceId, plan.roundId, 'CONVERSATION_NOT_WRITTEN', err instanceof Error ? err.message : 'the conversation could not be written')
      return
    }

    this.#emit(pieceId, { type: 'round.closed', data: { roundId: plan.roundId, outcome: result.outcome } })
  }
}
