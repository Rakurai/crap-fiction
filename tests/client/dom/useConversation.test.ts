import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationEntryView } from '../../../src/shared/conversationEntryViews.js'
import type { DispatchActivitySnapshot } from '../../../src/shared/conversationEvents.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomEvent } from '../../../src/client/entryProjection.js'
import { useConversation, type RoomAdapters } from '../../../src/client/useConversation.js'

const STARTED_AT = 1_700_000_000_000

function authorMessage(id: string, text: string): ConversationEntryView {
  return { id, kind: 'authorMessage', text, audience: [], brought: [] }
}

function activitySnapshot(actionId: string): DispatchActivitySnapshot {
  return { actionId, conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e0', audience: ['shape'], states: {}, startedAt: STARTED_AT }
}

function roomWithHeldConversation(entries: readonly ConversationEntryView[]) {
  let deliver: (event: RoomEvent) => void = () => {
    throw new Error('the room was never subscribed to')
  }
  let answer: () => void = () => {
    throw new Error('the conversation was never asked for')
  }

  const held = new Promise<RequestResult<{ id: string; entries: readonly ConversationEntryView[] }>>((resolve) => {
    answer = () => resolve({ outcome: 'value', value: { id: 'c1', entries } })
  })

  const room: RoomAdapters = {
    createConversation: vi.fn(),
    fetchConversation: vi.fn(() => held),
    dispatch: vi.fn(),
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
  it('keeps an entry that landed while the file was still being read, behind the entries that preceded it', async () => {
    const { room, stream, answerTheConversationRead } = roomWithHeldConversation([authorMessage('e1', 'what about e1'), authorMessage('e2', 'what about e2')])

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
      type: 'action.started',
      data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e3', startedAt: STARTED_AT, audience: ['shape'] },
    })
    stream({ type: 'entry.appended', data: { actionId: 'a1', entry: authorMessage('e3', 'and now') } })

    expect(result.current.projection.entries.map((entry) => entry.id)).toEqual(['e3'])
    expect(result.current.busy).toBe(true)

    await answerTheConversationRead()

    await waitFor(() => {
      expect(result.current.projection.entries.map((entry) => entry.id)).toEqual(['e1', 'e2', 'e3'])
    })
  })

  it("keeps the dispatch the piece reported in flight behind the file's entries too, and busy from the first render", async () => {
    const { room, answerTheConversationRead } = roomWithHeldConversation([authorMessage('e1', 'what about e1')])

    const { result } = renderHook(() =>
      useConversation(
        'the-lighthouse',
        'c1',
        activitySnapshot('a1'),
        () => {},
        () => 'the draft',
        room,
      ),
    )

    expect(result.current.busy).toBe(true)
    expect(result.current.projection.activity?.actionId).toBe('a1')

    await answerTheConversationRead()

    await waitFor(() => {
      expect(result.current.projection.entries.map((entry) => entry.id)).toEqual(['e1'])
    })
  })
})

describe('releasing the controls an action holds', () => {
  function streamingRoom() {
    let deliver: (event: RoomEvent) => void = () => {
      throw new Error('the room was never subscribed to')
    }

    const room: RoomAdapters = {
      createConversation: vi.fn(),
      fetchConversation: vi.fn(),
      dispatch: vi.fn(),
      abandonOperation: vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null })),
      applyRecommendation: vi.fn(),
      subscribeToRoom: vi.fn((_pieceId, onEvent) => {
        deliver = onEvent
        return () => {}
      }),
    }

    return { room, stream: (...events: readonly RoomEvent[]) => act(() => events.forEach((event) => deliver(event))) }
  }

  it('holds them for the newer action when the one it replaced settles behind it', () => {
    const { room, stream } = streamingRoom()

    const { result } = renderHook(() =>
      useConversation('the-lighthouse', null, activitySnapshot('a1'), () => {}, () => 'the draft', room),
    )

    act(() => {
      result.current.abandon()
    })
    stream({
      type: 'action.started',
      data: { actionId: 'a2', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e1', startedAt: STARTED_AT, audience: ['shape'] },
    })
    stream({ type: 'action.finished', data: { actionId: 'a1', outcome: 'abandoned' } })

    expect(result.current.busy).toBe(true)
    expect(result.current.actionId).toBe('a2')
  })

  it('releases them for an action started and finished in the same batch of frames', () => {
    const { room, stream } = streamingRoom()

    const { result } = renderHook(() => useConversation('the-lighthouse', null, null, () => {}, () => 'the draft', room))

    stream(
      {
        type: 'action.started',
        data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e1', startedAt: STARTED_AT, audience: ['shape'] },
      },
      { type: 'action.finished', data: { actionId: 'a1', outcome: 'settled' } },
    )

    expect(result.current.busy).toBe(false)
    expect(result.current.actionId).toBeUndefined()
  })
})

describe('abandoning an operation', () => {
  function idleRoom(
    abandonOperation: RoomAdapters['abandonOperation'] = vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null })),
  ): RoomAdapters {
    return {
      createConversation: vi.fn(),
      fetchConversation: vi.fn(),
      dispatch: vi.fn(),
      abandonOperation,
      applyRecommendation: vi.fn(),
      subscribeToRoom: vi.fn(() => () => {}),
    }
  }

  it('asks the room to abandon the piece\'s operation while one is in flight', async () => {
    const room = idleRoom()

    const { result } = renderHook(() =>
      useConversation('the-lighthouse', null, activitySnapshot('a1'), () => {}, () => 'the draft', room),
    )

    await act(async () => {
      result.current.abandon()
    })

    expect(room.abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'c1', 'a1')
  })

  it('releases busy and the activity snapshot the instant abandon is called, before the request resolves', () => {
    const room = idleRoom(vi.fn(() => new Promise<RequestResult<null>>(() => {})))

    const { result } = renderHook(() =>
      useConversation('the-lighthouse', null, activitySnapshot('a1'), () => {}, () => 'the draft', room),
    )

    act(() => {
      result.current.abandon()
    })

    expect(result.current.busy).toBe(false)
    expect(result.current.projection.activity).toBeUndefined()
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
      useConversation('the-lighthouse', null, activitySnapshot('a1'), () => {}, () => 'the draft', room),
    )

    await act(async () => {
      result.current.abandon()
    })

    await waitFor(() => expect(result.current.error).toBe('the studio did not answer'))
  })
})
