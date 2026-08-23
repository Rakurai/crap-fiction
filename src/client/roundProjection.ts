import type { ParticipantResult, RoundRecord } from '../shared/conversationViews.js'
import type {
  ParticipantSettledEvent,
  ParticipantStateEvent,
  RoundClosedEvent,
  RoundOpenedEvent,
  RoundSnapshot,
} from '../shared/roundEvents.js'

export type ProjectedParticipantState = 'waiting' | 'preparing' | 'working' | 'settled'

export type ProjectedParticipant = Readonly<{
  participantId: string
  state: ProjectedParticipantState
  result: ParticipantResult | undefined
}>

export type ProjectedRound = Readonly<{
  roundId: string
  message: string | undefined
  /**
   * `failed` is the room's own failure rather than any participant's, and it is
   * separate from `inFlight` because a round that stopped is not a round still
   * running — the surface draws it as ended, whatever each participant had
   * reached when it ended.
   */
  outcome: 'inFlight' | 'settled' | 'abandoned' | 'failed'
  participants: readonly ProjectedParticipant[]
}>

export type ConversationProjection = Readonly<{ rounds: readonly ProjectedRound[] }>

export type RoundEvent =
  | Readonly<{ type: 'round.opened'; data: RoundOpenedEvent }>
  | Readonly<{ type: 'participant.state'; data: ParticipantStateEvent }>
  | Readonly<{ type: 'participant.settled'; data: ParticipantSettledEvent }>
  | Readonly<{ type: 'round.closed'; data: RoundClosedEvent }>

export const EMPTY_PROJECTION: ConversationProjection = { rounds: [] }

function fromRecord(round: RoundRecord): ProjectedRound {
  return {
    roundId: round.id,
    message: round.message,
    outcome: round.outcome,
    participants: round.participants.map((record) => ({ participantId: record.participantId, state: 'settled', result: record.result })),
  }
}

/** SPEC "Seams": a new round preserves earlier rounds — this is what a reload's settled history becomes before any live event lands. */
export function initialProjection(rounds: readonly RoundRecord[]): ConversationProjection {
  return { rounds: rounds.map(fromRecord) }
}

/**
 * A round already in flight when the client (re)connects — SPEC "Operation
 * state": reading the piece reports whatever operation is in flight, so a
 * client that reloaded knows what it is looking at without a new event.
 * Seeded the same way `round.opened` seeds a live one: every participant the
 * round will call, in a stable order, before any of them settle.
 */
export function withRoundInFlight(projection: ConversationProjection, snapshot: RoundSnapshot): ConversationProjection {
  if (projection.rounds.some((round) => round.roundId === snapshot.roundId)) return projection

  const settled = new Map(snapshot.settled.map((record) => [record.participantId, record.result]))
  const round: ProjectedRound = {
    roundId: snapshot.roundId,
    message: snapshot.message,
    outcome: 'inFlight',
    participants: snapshot.participants.map((participantId) => ({
      participantId,
      state: settled.has(participantId) ? 'settled' : snapshot.states[participantId] ?? 'waiting',
      result: settled.get(participantId),
    })),
  }
  return { rounds: [...projection.rounds, round] }
}

function updateRound(projection: ConversationProjection, roundId: string, update: (round: ProjectedRound) => ProjectedRound): ConversationProjection {
  return { rounds: projection.rounds.map((round) => (round.roundId === roundId ? update(round) : round)) }
}

function updateParticipant(round: ProjectedRound, participantId: string, update: (participant: ProjectedParticipant) => ProjectedParticipant): ProjectedRound {
  return { ...round, participants: round.participants.map((participant) => (participant.participantId === participantId ? update(participant) : participant)) }
}

/**
 * SPEC "Seams": the projection is a pure reducer rather than a boundary, so every
 * load-bearing rule lives here rather than in the surface that renders it —
 * participants seeded in a stable order when a round opens, earlier rounds
 * preserved, abandonment adding nothing beyond what landed, a failed
 * participant staying distinct from a no-comment one (both cross untouched
 * in `ParticipantResult`'s own shape), and a response delivered twice
 * appearing once (settling the same participant a second time overwrites
 * rather than appends).
 */
export function projectRoundEvent(projection: ConversationProjection, event: RoundEvent): ConversationProjection {
  switch (event.type) {
    case 'round.opened': {
      if (projection.rounds.some((round) => round.roundId === event.data.roundId)) return projection
      const round: ProjectedRound = {
        roundId: event.data.roundId,
        message: event.data.message,
        outcome: 'inFlight',
        participants: event.data.participants.map((participantId) => ({ participantId, state: 'waiting', result: undefined })),
      }
      return { rounds: [...projection.rounds, round] }
    }
    case 'participant.state': {
      const { roundId, participantId, state } = event.data
      return updateRound(projection, roundId, (round) => updateParticipant(round, participantId, (participant) => ({ ...participant, state })))
    }
    case 'participant.settled': {
      const { roundId, participantId, result } = event.data
      return updateRound(projection, roundId, (round) => updateParticipant(round, participantId, (participant) => ({ ...participant, state: 'settled', result })))
    }
    case 'round.closed': {
      const { roundId, outcome } = event.data
      return updateRound(projection, roundId, (round) => ({ ...round, outcome }))
    }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
