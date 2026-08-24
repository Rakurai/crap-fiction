import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROJECTION,
  everyCallFailed,
  initialProjection,
  projectRoundEvent,
  tallyRound,
  withAppliedChange,
  withRoundInFlight,
  type ConversationProjection,
  type ProjectedRound,
  type RoundEvent,
} from '../../src/client/roundProjection.js'
import type { AppliedChange } from '../../src/shared/appliedChange.js'
import type { RoundRecord, RoundView } from '../../src/shared/conversationViews.js'
import type { RoundClosedEvent, RoundSnapshot } from '../../src/shared/roundEvents.js'

const OPENED_AT = 1_700_000_000_000

function opened(roundId: string, participants: readonly string[], message?: string, brought: readonly string[] = []): RoundEvent {
  return { type: 'round.opened', data: { roundId, conversationId: 'c1', message, participants, brought, openedAt: OPENED_AT } }
}

function state(roundId: string, participantId: string, state: 'preparing' | 'working'): RoundEvent {
  return { type: 'participant.state', data: { roundId, participantId, state } }
}

function settled(roundId: string, participantId: string, result: RoundRecord['participants'][number]['result']): RoundEvent {
  return { type: 'participant.settled', data: { roundId, participantId, result } }
}

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

const noChange: AppliedChange = {
  id: 'change1',
  roundId: 'r1',
  participantId: 'shape',
  content: { kind: 'rewrittenWhole' },
}

describe('initialProjection', () => {
  it('projects a conversation file\'s settled rounds as already-settled, so a reload shows them with no new event', () => {
    const rounds: readonly RoundView[] = [
      {
        id: 'r1',
        message: '@shape does the opening earn its length',
        addressed: ['shape'],
        brought: [],
        outcome: 'settled',
        participants: [
          { participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late' }, appliedChanges: [] },
        ],
      },
    ]

    const projection = initialProjection(rounds)

    expect(projection.rounds).toEqual([
      {
        roundId: 'r1',
        message: '@shape does the opening earn its length',
        openedAt: undefined,
        outcome: 'settled',
        participants: [
          { participantId: 'shape', state: 'settled', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late' }, appliedChanges: [] },
        ],
        brought: [],
      },
    ])
  })

  it('carries each response\'s applied changes read back off the file, so a reload shows what an earlier application did', () => {
    const rounds: readonly RoundView[] = [
      {
        id: 'r1',
        addressed: [],
        brought: [],
        outcome: 'settled',
        participants: [
          {
            participantId: 'shape',
            result: { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut the second paragraph' },
            appliedChanges: [noChange],
          },
        ],
      },
    ]

    const projection = initialProjection(rounds)

    expect(projection.rounds[0]?.participants[0]?.appliedChanges).toEqual([noChange])
  })
})

describe('withAppliedChange', () => {
  it('attaches a change onto the response that caused it, and leaves every other response untouched', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut it' }))
    projection = projectRoundEvent(projection, settled('r1', 'compression', { kind: 'response', outcome: 'commentary', claim: 'it holds' }))

    projection = withAppliedChange(projection, 'r1', 'shape', noChange)

    const [shape, compression] = projection.rounds[0]?.participants ?? []
    expect(shape?.appliedChanges).toEqual([noChange])
    expect(compression?.appliedChanges).toEqual([])
  })

  it('appends rather than replaces, where a recommendation was applied more than once', () => {
    const second: AppliedChange = { ...noChange, id: 'change2' }
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut it' }))

    projection = withAppliedChange(projection, 'r1', 'shape', noChange)
    projection = withAppliedChange(projection, 'r1', 'shape', second)

    expect(projection.rounds[0]?.participants[0]?.appliedChanges).toEqual([noChange, second])
  })
})

describe('tallyRound', () => {
  it('counts each state, with an answered participant counted whatever it answered', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression', 'interiority', 'story-editor']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'response', outcome: 'commentary', claim: 'x' }))
    projection = projectRoundEvent(projection, settled('r1', 'compression', { kind: 'failed', reason: 'timeout' }))
    projection = projectRoundEvent(projection, state('r1', 'interiority', 'working'))

    expect(tallyRound(round(projection))).toEqual({ working: 1, preparing: 0, answered: 2, waiting: 1 })
  })
})

describe('everyCallFailed', () => {
  it('is true only once the round has ended and every call it made failed', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'failed', reason: 'timeout' }))
    projection = projectRoundEvent(projection, settled('r1', 'compression', { kind: 'failed', reason: 'unreachable' }))
    expect(everyCallFailed(round(projection))).toBe(false)

    projection = projectRoundEvent(projection, closed('r1', 'settled'))
    expect(everyCallFailed(round(projection))).toBe(true)
  })

  it('is false when one call answered, however little it said', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'failed', reason: 'timeout' }))
    projection = projectRoundEvent(projection, settled('r1', 'compression', { kind: 'response', outcome: 'noComment' }))
    projection = projectRoundEvent(projection, closed('r1', 'settled'))

    expect(everyCallFailed(round(projection))).toBe(false)
  })

  it('is false for a round the room failed before it reached everyone: those calls were never made', () => {
    let projection = projectRoundEvent(EMPTY_PROJECTION, opened('r1', ['shape', 'compression']))
    projection = projectRoundEvent(projection, settled('r1', 'shape', { kind: 'failed', reason: 'timeout' }))
    projection = projectRoundEvent(projection, closed('r1', 'failed'))

    expect(everyCallFailed(round(projection))).toBe(false)
  })
})

function round(projection: ConversationProjection): ProjectedRound {
  const first = projection.rounds[0]
  if (first === undefined) throw new Error('the projection holds no round')
  return first
}

describe('withRoundInFlight', () => {
  it('seeds a round already in flight when the client reconnects, with what already settled intact', () => {
    const snapshot: RoundSnapshot = {
      conversationId: 'c1',
      roundId: 'r1',
      message: 'a message',
      participants: ['shape', 'compression'],
      brought: [],
      states: { compression: 'working' },
      settled: [{ participantId: 'shape', result: { kind: 'response', outcome: 'noComment' } }],
      openedAt: OPENED_AT,
    }

    const projection: ConversationProjection = withRoundInFlight(EMPTY_PROJECTION, snapshot)

    expect(projection.rounds).toEqual([
      {
        roundId: 'r1',
        message: 'a message',
        openedAt: OPENED_AT,
        outcome: 'inFlight',
        participants: [
          { participantId: 'shape', state: 'settled', result: { kind: 'response', outcome: 'noComment' }, appliedChanges: [] },
          { participantId: 'compression', state: 'working', result: undefined, appliedChanges: [] },
        ],
        brought: [],
      },
    ])
  })
})

describe('a resumed round and a live one', () => {
  it('project identically', () => {
    const participants = ['shape', 'compression', 'interiority', 'story-editor']

    let live = projectRoundEvent(EMPTY_PROJECTION, opened('r1', participants, 'a message'))
    live = projectRoundEvent(live, settled('r1', 'shape', { kind: 'response', outcome: 'commentary', claim: 'the entry is late', note: 'by a paragraph' }))
    live = projectRoundEvent(live, settled('r1', 'compression', { kind: 'failed', reason: 'timeout' }))
    live = projectRoundEvent(live, state('r1', 'interiority', 'preparing'))
    live = projectRoundEvent(live, state('r1', 'interiority', 'working'))

    const snapshot: RoundSnapshot = {
      conversationId: 'c1',
      roundId: 'r1',
      message: 'a message',
      participants,
      brought: [],
      states: { interiority: 'working' },
      settled: [
        { participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late', note: 'by a paragraph' } },
        { participantId: 'compression', result: { kind: 'failed', reason: 'timeout' } },
      ],
      openedAt: OPENED_AT,
    }
    const resumed = withRoundInFlight(EMPTY_PROJECTION, snapshot)

    expect(resumed).toEqual(live)
  })
})
