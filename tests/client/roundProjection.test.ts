import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROJECTION,
  initialProjection,
  projectRoundEvent,
  withRoundInFlight,
  type ConversationProjection,
  type RoundEvent,
} from '../../src/client/roundProjection.js'
import type { RoundRecord } from '../../src/shared/conversationViews.js'
import type { RoundClosedEvent, RoundSnapshot } from '../../src/shared/roundEvents.js'

function opened(roundId: string, participants: readonly string[], message?: string): RoundEvent {
  return { type: 'round.opened', data: { roundId, conversationId: 'c1', message, participants } }
}

function state(roundId: string, participantId: string, state: 'preparing' | 'working'): RoundEvent {
  return { type: 'participant.state', data: { roundId, participantId, state } }
}

function settled(roundId: string, participantId: string, result: RoundRecord['participants'][number]['result']): RoundEvent {
  return { type: 'participant.settled', data: { roundId, participantId, result } }
}

/** The outcome comes from the event's own closed set rather than being retyped here. */
function closed(roundId: string, outcome: RoundClosedEvent['outcome']): RoundEvent {
  return { type: 'round.closed', data: { roundId, outcome } }
}

describe('projectRoundEvent', () => {
  it('seeds every participant the round will call, in a stable order, as waiting, the moment it opens', () => {
    const projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression', 'story-editor'], 'a message'))

    expect(projection.rounds).toHaveLength(1)
    expect(projection.rounds[0]?.participants.map((p) => [p.participantId, p.state])).toEqual([
      ['shape', 'waiting'],
      ['compression', 'waiting'],
      ['story-editor', 'waiting'],
    ])
    expect(projection.rounds[0]?.outcome).toBe('inFlight')
  })

  it('moves a seeded participant through preparing and working as its state changes', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape']))
    projection = projectRoundEvent(projection, state('r1', 'shape', 'preparing'))
    expect(projection.rounds[0]?.participants[0]?.state).toBe('preparing')

    projection = projectRoundEvent(projection, state('r1', 'shape', 'working'))
    expect(projection.rounds[0]?.participants[0]?.state).toBe('working')
  })

  it('a new round preserves earlier rounds', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'commentary', claim: 'x' }))
    projection = projectRoundEvent(projection, closed('r1', 'settled'))

    projection = projectRoundEvent(projection, opened('r2', ['shape']))

    expect(projection.rounds).toHaveLength(2)
    expect(projection.rounds[0]?.roundId).toBe('r1')
    expect(projection.rounds[1]?.roundId).toBe('r2')
  })

  it('keeps a failed participant distinct from a no-comment one', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'failed', reason: 'timeout' }))
    projection = projectRoundEvent(projection, settled('r1', 'compression', { kind: 'response', outcome: 'noComment' }))

    const [shape, compression] = projection.rounds[0]?.participants ?? []
    expect(shape?.result).toEqual({ kind: 'failed', reason: 'timeout' })
    expect(compression?.result).toEqual({ kind: 'response', outcome: 'noComment' })
  })

  it('abandonment keeps what landed and adds nothing further', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'commentary', claim: 'landed' }))
    projection = projectRoundEvent(projection, closed('r1', 'abandoned'))

    expect(projection.rounds[0]?.outcome).toBe('abandoned')
    expect(projection.rounds[0]?.participants.map((p) => p.participantId)).toEqual(['shape', 'compression'])
    expect(projection.rounds[0]?.participants.find((p) => p.participantId === 'compression')?.result).toBeUndefined()
  })

  it('a round the room failed is drawn as ended, not as still running, with what landed before the failure kept', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'commentary', claim: 'landed' }))
    projection = projectRoundEvent(projection, closed('r1', 'failed'))

    // The room's own failure is not a participant's, so nothing is invented for
    // the participants the round never reached — but the round is over.
    expect(projection.rounds[0]?.outcome).toBe('failed')
    expect(projection.rounds[0]?.participants.find((p) => p.participantId === 'shape')?.result).toEqual({
      kind: 'response',
      outcome: 'commentary',
      claim: 'landed',
    })
    expect(projection.rounds[0]?.participants.find((p) => p.participantId === 'compression')?.result).toBeUndefined()
  })

  it('a response delivered twice appears once', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'commentary', claim: 'first' }))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'commentary', claim: 'first' }))

    expect(projection.rounds[0]?.participants).toHaveLength(1)
  })

  it('ignores a duplicate round.opened for a round already seeded', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'noComment' }))
    projection = projectRoundEvent(projection, opened('r1', ['shape']))

    expect(projection.rounds).toHaveLength(1)
    expect(projection.rounds[0]?.participants[0]?.state).toBe('settled')
  })
})

describe('initialProjection', () => {
  it('projects a conversation file\'s settled rounds as already-settled, so a reload shows them with no new event', () => {
    const rounds: readonly RoundRecord[] = [
      {
        id: 'r1',
        message: '@shape does the opening earn its length',
        addressed: ['shape'],
        outcome: 'settled',
        participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late' } }],
      },
    ]

    const projection = initialProjection(rounds)

    expect(projection.rounds).toEqual([
      {
        roundId: 'r1',
        message: '@shape does the opening earn its length',
        outcome: 'settled',
        participants: [{ participantId: 'shape', state: 'settled', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late' } }],
      },
    ])
  })
})

describe('withRoundInFlight', () => {
  it('seeds a round already in flight when the client reconnects, with what already settled intact', () => {
    const snapshot: RoundSnapshot = {
      conversationId: 'c1',
      roundId: 'r1',
      message: 'a message',
      participants: ['shape', 'compression'],
      states: { compression: 'working' },
      settled: [{ participantId: 'shape', result: { kind: 'response', outcome: 'noComment' } }],
    }

    const projection: ConversationProjection = withRoundInFlight(EMPTY_PROJECTION, snapshot)

    expect(projection.rounds).toEqual([
      {
        roundId: 'r1',
        message: 'a message',
        outcome: 'inFlight',
        participants: [
          { participantId: 'shape', state: 'settled', result: { kind: 'response', outcome: 'noComment' } },
          { participantId: 'compression', state: 'working', result: undefined },
        ],
      },
    ])
  })
})
