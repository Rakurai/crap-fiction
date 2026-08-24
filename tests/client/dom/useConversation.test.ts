import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationView, RoundView } from '../../../src/shared/conversationViews.js'
import type { RoundSnapshot } from '../../../src/shared/roundEvents.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomEvent } from '../../../src/client/roomClient.js'
import { useConversation, type RoomAdapters } from '../../../src/client/useConversation.js'

const OPENED_AT = 1_700_000_000_000

function settledRound(id: string): RoundView {
  return {
    id,
    message: `what about ${id}`,
    addressed: ['shape'],
    brought: [],
    participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'noComment' }, appliedChanges: [] }],
    outcome: 'settled',
  }
}

function snapshot(roundId: string): RoundSnapshot {
  return { conversationId: 'c1', roundId, message: 'the live one', participants: ['shape'], brought: [], states: {}, settled: [], openedAt: OPENED_AT }
}

function roomWithHeldConversation(conversation: ConversationView) {
  let deliver: (event: RoomEvent) => void = () => {
    throw new Error('the room was never subscribed to')
  }
  let answer: () => void = () => {
    throw new Error('the conversation was never asked for')
  }

  const held = new Promise<RequestResult<ConversationView>>((resolve) => {
    answer = () => resolve({ outcome: 'value', value: conversation })
  })

  const room: RoomAdapters = {
    createConversation: vi.fn(),
    fetchConversation: vi.fn(() => held),
    startRound: vi.fn(),
    abandonOperation: vi.fn(),
    applyRecommendation: vi.fn(),
    subscribeToRoom: vi.fn((_pieceId, onEvent) => {
      deliver = onEvent
      return () => {}
    }),
  }

  return {
    room,
    stream: (event: RoomEvent) => act(() => deliver(event)),
    answerTheConversationRead: async () => {
      answer()
      await act(async () => {
        await held
      })
    },
  }
}

describe('merging the conversation on disk with the one being streamed', () => {
  it('keeps a round that opened while the file was still being read, behind the rounds that preceded it', async () => {
    const { room, stream, answerTheConversationRead } = roomWithHeldConversation({
      id: 'c1',
      rounds: [settledRound('r1'), settledRound('r2')],
    })

    const { result } = renderHook(() =>
      useConversation(
        'the-lighthouse',
        'c1',
        null,
        () => {},
        () => 'the draft',
        room,
      ),
    )

    stream({
      type: 'round.opened',
      data: { conversationId: 'c1', roundId: 'r3', message: 'and now', participants: ['shape'], brought: [], openedAt: OPENED_AT },
    })

    expect(result.current.projection.rounds.map((round) => round.roundId)).toEqual(['r3'])
    expect(result.current.busy).toBe(true)

    await answerTheConversationRead()

    await waitFor(() => {
      expect(result.current.projection.rounds.map((round) => round.roundId)).toEqual(['r1', 'r2', 'r3'])
    })
    expect(result.current.projection.rounds.map((round) => round.outcome)).toEqual(['settled', 'settled', 'inFlight'])
  })

  it('keeps the round the piece reported in flight behind the file\'s rounds too, and busy from the first render', async () => {
    const { room, answerTheConversationRead } = roomWithHeldConversation({ id: 'c1', rounds: [settledRound('r1')] })

    const { result } = renderHook(() =>
      useConversation(
        'the-lighthouse',
        'c1',
        snapshot('r2'),
        () => {},
        () => 'the draft',
        room,
      ),
    )

    expect(result.current.busy).toBe(true)
    expect(result.current.projection.rounds.map((round) => round.roundId)).toEqual(['r2'])

    await answerTheConversationRead()

    await waitFor(() => {
      expect(result.current.projection.rounds.map((round) => round.roundId)).toEqual(['r1', 'r2'])
    })
  })
})

describe('abandoning an operation', () => {
  function idleRoom(
    abandonOperation: RoomAdapters['abandonOperation'] = vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null })),
  ): RoomAdapters {
    return {
      createConversation: vi.fn(),
      fetchConversation: vi.fn(),
      startRound: vi.fn(),
      abandonOperation,
      applyRecommendation: vi.fn(),
      subscribeToRoom: vi.fn(() => () => {}),
    }
  }

  it('asks the room to abandon the piece\'s operation while one is in flight', async () => {
    const room = idleRoom()

    const { result } = renderHook(() =>
      useConversation('the-lighthouse', null, snapshot('r1'), () => {}, () => 'the draft', room),
    )

    await act(async () => {
      result.current.abandon()
    })

    expect(room.abandonOperation).toHaveBeenCalledWith('the-lighthouse')
  })

  it('asks nothing when no operation is in flight', () => {
    const room = idleRoom()

    const { result } = renderHook(() =>
      useConversation('the-lighthouse', null, null, () => {}, () => 'the draft', room),
    )

    result.current.abandon()

    expect(room.abandonOperation).not.toHaveBeenCalled()
  })

  it('reports it when the studio cannot be asked to abandon', async () => {
    const room = idleRoom(vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'unreachable', message: 'the studio did not answer' })))

    const { result } = renderHook(() =>
      useConversation('the-lighthouse', null, snapshot('r1'), () => {}, () => 'the draft', room),
    )

    await act(async () => {
      result.current.abandon()
    })

    await waitFor(() => expect(result.current.error).toBe('the studio did not answer'))
  })
})
