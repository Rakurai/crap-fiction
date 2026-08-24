import type { AppliedChange } from '../shared/appliedChange.js'
import type { ParticipantResult, RoundView } from '../shared/conversationViews.js'
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
  /** CONTEXT "Applied change": every change an application caused on this response, in the order they were applied. */
  appliedChanges: readonly AppliedChange[]
}>

export type ProjectedRound = Readonly<{
  roundId: string
  message: string | undefined
  /**
   * When the round opened, as the studio's clock read it — the one fact the
   * elapsed count is measured from. It is absent for a round read back from a
   * conversation file, because a settled round has no elapsed time to show and
   * the record carries no stamp: SPEC's conversation file holds what was said,
   * not how long the saying took.
   */
  openedAt: number | undefined
  /**
   * `failed` is the room's own failure rather than any participant's, and it is
   * separate from `inFlight` because a round that stopped is not a round still
   * running — the surface draws it as ended, whatever each participant had
   * reached when it ended.
   */
  outcome: 'inFlight' | 'settled' | 'abandoned' | 'failed'
  participants: readonly ProjectedParticipant[]
  /** UX_DESIGN "Where the author speaks": ids this round's addressing durably enabled — ordinarily empty. */
  brought: readonly string[]
}>

export type ConversationProjection = Readonly<{ rounds: readonly ProjectedRound[] }>

export type RoundEvent =
  | Readonly<{ type: 'round.opened'; data: RoundOpenedEvent }>
  | Readonly<{ type: 'participant.state'; data: ParticipantStateEvent }>
  | Readonly<{ type: 'participant.settled'; data: ParticipantSettledEvent }>
  | Readonly<{ type: 'round.closed'; data: RoundClosedEvent }>

export const EMPTY_PROJECTION: ConversationProjection = { rounds: [] }

function fromRecord(round: RoundView): ProjectedRound {
  return {
    roundId: round.id,
    message: round.message,
    openedAt: undefined,
    outcome: round.outcome,
    participants: round.participants.map((record) => ({
      participantId: record.participantId,
      state: 'settled',
      result: record.result,
      appliedChanges: record.appliedChanges,
    })),
    brought: round.brought,
  }
}

/** SPEC "Seams": a new round preserves earlier rounds — this is what a reload's settled history becomes before any live event lands. */
export function initialProjection(rounds: readonly RoundView[]): ConversationProjection {
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
    openedAt: snapshot.openedAt,
    outcome: 'inFlight',
    participants: snapshot.participants.map((participantId) => ({
      participantId,
      state: settled.has(participantId) ? 'settled' : snapshot.states[participantId] ?? 'waiting',
      result: settled.get(participantId),
      appliedChanges: [],
    })),
    brought: snapshot.brought,
  }
  return { rounds: [...projection.rounds, round] }
}

/**
 * How many participants are in each state, which is what UX_DESIGN "A round in
 * flight" asks the round to say about itself: states and counts rather than a
 * composed sentence. `answered` counts settled places whatever they settled to —
 * a failed call and a no-comment response are both answers the round is no longer
 * waiting on, and the difference between them is stated on the participant, not in
 * a count of the room.
 */
export type RoundTally = Readonly<{
  working: number
  preparing: number
  answered: number
  waiting: number
}>

export function tallyRound(round: ProjectedRound): RoundTally {
  const count = (state: ProjectedParticipantState): number => round.participants.filter((participant) => participant.state === state).length
  return { working: count('working'), preparing: count('preparing'), answered: count('settled'), waiting: count('waiting') }
}

/**
 * Whether the round has nothing to show: it is over, it called someone, and every
 * one of them failed. A round the room itself failed does not qualify — its
 * unreached participants have no result at all, and saying every call failed of a
 * round whose calls were never made would be a claim about work that never
 * happened.
 */
export function everyCallFailed(round: ProjectedRound): boolean {
  if (round.outcome === 'inFlight') return false
  if (round.participants.length === 0) return false
  return round.participants.every((participant) => participant.result?.kind === 'failed')
}

function updateRound(projection: ConversationProjection, roundId: string, update: (round: ProjectedRound) => ProjectedRound): ConversationProjection {
  return { rounds: projection.rounds.map((round) => (round.roundId === roundId ? update(round) : round)) }
}

function updateParticipant(round: ProjectedRound, participantId: string, update: (participant: ProjectedParticipant) => ProjectedParticipant): ProjectedRound {
  return { ...round, participants: round.participants.map((participant) => (participant.participantId === participantId ? update(participant) : participant)) }
}

/**
 * CONTEXT "Applied change": attaches a change onto the response that caused
 * it, the moment applying it settles — not an event the room streamed, since
 * apply has none, but the same shape a projection update always has here.
 */
export function withAppliedChange(projection: ConversationProjection, roundId: string, participantId: string, change: AppliedChange): ConversationProjection {
  return updateRound(projection, roundId, (round) =>
    updateParticipant(round, participantId, (participant) => ({ ...participant, appliedChanges: [...participant.appliedChanges, change] })),
  )
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
        openedAt: event.data.openedAt,
        outcome: 'inFlight',
        participants: event.data.participants.map((participantId) => ({ participantId, state: 'waiting', result: undefined, appliedChanges: [] })),
        brought: event.data.brought,
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
