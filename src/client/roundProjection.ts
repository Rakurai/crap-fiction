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
  appliedChanges: readonly AppliedChange[]
}>

export type ProjectedRound = Readonly<{
  roundId: string
  message: string | undefined
  openedAt: number | undefined
  outcome: 'inFlight' | 'settled' | 'abandoned' | 'failed'
  participants: readonly ProjectedParticipant[]
  brought: readonly string[]
  respondingTo: Readonly<{ roundId: string; participantId: string }> | undefined
  clarification: string | undefined
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
    respondingTo: round.respondingTo,
    clarification: round.clarification,
  }
}

export function initialProjection(rounds: readonly RoundView[]): ConversationProjection {
  return { rounds: rounds.map(fromRecord) }
}

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
    respondingTo: snapshot.respondingTo,
    clarification: snapshot.clarification,
  }
  return { rounds: [...projection.rounds, round] }
}

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

export function withAppliedChange(projection: ConversationProjection, roundId: string, participantId: string, change: AppliedChange): ConversationProjection {
  return updateRound(projection, roundId, (round) =>
    updateParticipant(round, participantId, (participant) => ({ ...participant, appliedChanges: [...participant.appliedChanges, change] })),
  )
}

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
        respondingTo: event.data.respondingTo,
        clarification: event.data.clarification,
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
