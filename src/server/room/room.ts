import { nanoid } from 'nanoid'
import type { Charter } from '../model/charter.js'
import type { ModelAccess } from '../model/modelAccess.js'
import type { ModeDescriptor } from '../modes.js'
import { PieceNotFoundError } from '../pieces.js'
import type { RoleDefinition } from '../model/roles.js'
import { readConversation, readPiece, writeConversation, writePieceCast } from '../store/index.js'
import { conversationSchema, type RoundParticipantRecord, type RoundRecord } from '../../shared/conversationViews.js'
import type {
  ParticipantSettledEvent,
  ParticipantStateEvent,
  RoomErrorEvent,
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

type ActiveOperation = {
  readonly conversationId: string
  readonly roundId: string
  readonly message: string | undefined
  readonly participants: readonly string[]
  readonly states: Map<string, 'preparing' | 'working'>
  readonly settled: RoundParticipantRecord[]
  readonly controller: AbortController
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
  readonly #operations = new Map<string, ActiveOperation>()
  readonly #settlements = new Map<string, Promise<void>>()
  readonly #listeners = new Map<string, Set<Listener>>()

  constructor(modelAccess: ModelAccess, roles: readonly RoleDefinition[], charter: Charter, mode: ModeDescriptor, policy: HistoryPolicy = 'shared') {
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

  snapshot(pieceId: string): RoundSnapshot | undefined {
    const operation = this.#operations.get(pieceId)
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
   */
  async startRound(
    workspaceDir: string,
    pieceId: string,
    conversationId: string,
    message: string,
    draft: string,
  ): Promise<{ conversationId: string; roundId: string }> {
    if (this.#operations.has(pieceId)) throw new RoomBusyError(pieceId)

    const piece = readPiece(workspaceDir, pieceId)
    if (piece === undefined) throw new PieceNotFoundError(pieceId)

    const addressed = parseAddressing(message, [...this.#specialists, this.#storyEditor])
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

    const operation: ActiveOperation = {
      conversationId,
      roundId,
      message,
      participants,
      states: new Map(),
      settled: [],
      controller: new AbortController(),
    }
    this.#operations.set(pieceId, operation)
    this.#emit(pieceId, { type: 'round.opened', data: { conversationId, roundId, message, participants } })

    this.#settlements.set(
      pieceId,
      this.#run(workspaceDir, pieceId, conversationId, plan, draft, operation).finally(() => {
        this.#operations.delete(pieceId)
        this.#settlements.delete(pieceId)
      }),
    )

    return { conversationId, roundId }
  }

  abandon(pieceId: string): void {
    this.#operations.get(pieceId)?.controller.abort()
  }

  async #run(
    workspaceDir: string,
    pieceId: string,
    conversationId: string,
    plan: RoundPlan,
    draft: string,
    operation: ActiveOperation,
  ): Promise<void> {
    try {
      const existing = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)

      const result = await runRound({
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

      const round: RoundRecord = {
        id: plan.roundId,
        message: plan.message,
        addressed: plan.addressedIds,
        participants: result.participants,
        outcome: result.outcome,
      }
      await writeConversation(workspaceDir, pieceId, conversationId, {
        id: conversationId,
        rounds: [...(existing?.rounds ?? []), round],
      })

      this.#emit(pieceId, { type: 'round.closed', data: { roundId: plan.roundId, outcome: result.outcome } })
    } catch (err) {
      this.#emit(pieceId, {
        type: 'error',
        data: { code: 'ROOM_FAILURE', message: err instanceof Error ? err.message : 'the room failed unexpectedly' },
      })
    }
  }
}
