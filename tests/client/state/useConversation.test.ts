import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationEntryView } from '../../../src/shared/conversationEntryViews.js'
import type { ConversationActivitySnapshot, DispatchActivitySnapshot, RoomActivitySnapshot } from '../../../src/shared/conversationEvents.js'
import type { DocumentSnapshot } from '../../../src/shared/surfaces.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomEvent } from '../../../src/client/entryProjection.js'
import { useConversation, type RoomAdapters } from '../../../src/client/useConversation.js'

const STARTED_AT = 1_700_000_000_000

const EMPTY_ROOM_ACTIVITY: RoomActivitySnapshot = { draft: null, storyContext: null, authorContext: null }
const DOCUMENTS: DocumentSnapshot = { draft: 'the draft', storyContext: 'the story context', authorContext: 'the author context' }

function authorMessage(id: string, text: string): ConversationEntryView {
  return { id, kind: 'authorMessage', text, audience: [], brought: [] }
}

function activitySnapshot(actionId: string): DispatchActivitySnapshot {
  return { actionId, conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e0', audience: ['shape'], states: {}, startedAt: STARTED_AT }
}

function roomWithHeldConversation(entries: readonly ConversationEntryView[], draftActivity: ConversationActivitySnapshot | null = null) {
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
    confirmApplication: vi.fn(),
    saveDocument: vi.fn(),
    subscribeToRoom: vi.fn((_pieceId, onEvent) => {
      deliver = onEvent
      return { snapshot: Promise.resolve({ ...EMPTY_ROOM_ACTIVITY, draft: draftActivity }), unsubscribe: () => {} }
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

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', () => {}, () => DOCUMENTS, room))

    stream({
      type: 'action.started',
      data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e3', startedAt: STARTED_AT, audience: ['shape'], surface: 'draft' },
    })
    stream({ type: 'entry.appended', data: { actionId: 'a1', entry: authorMessage('e3', 'and now'), surface: 'draft' } })

    expect(result.current.projection.entries.map((entry) => entry.id)).toEqual(['e3'])
    expect(result.current.busy).toBe(true)

    await answerTheConversationRead()

    await waitFor(() => {
      expect(result.current.projection.entries.map((entry) => entry.id)).toEqual(['e1', 'e2', 'e3'])
    })
  })

  it("resumes the dispatch the room reports in flight once the stream's snapshot resolves, behind the file's entries too", async () => {
    const { room, answerTheConversationRead } = roomWithHeldConversation([authorMessage('e1', 'what about e1')], activitySnapshot('a1'))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', () => {}, () => DOCUMENTS, room))

    await waitFor(() => {
      expect(result.current.busy).toBe(true)
      expect(result.current.projection.activity?.actionId).toBe('a1')
    })

    await answerTheConversationRead()

    await waitFor(() => {
      expect(result.current.projection.entries.map((entry) => entry.id)).toEqual(['e1'])
    })
  })

  it('ignores the snapshot when its action belongs to a different conversation than the one this hook opened', async () => {
    const { room } = roomWithHeldConversation([], { ...activitySnapshot('a1'), conversationId: 'some-other-conversation' })

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', () => {}, () => DOCUMENTS, room))

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.busy).toBe(false)
    expect(result.current.actionId).toBeUndefined()
  })
})

describe('releasing the controls an action holds', () => {
  function streamingRoom(draftActivity: ConversationActivitySnapshot | null = null) {
    let deliver: (event: RoomEvent) => void = () => {
      throw new Error('the room was never subscribed to')
    }

    const room: RoomAdapters = {
      createConversation: vi.fn(),
      fetchConversation: vi.fn(() => Promise.resolve<RequestResult<{ id: string; entries: readonly ConversationEntryView[] }>>({ outcome: 'value', value: { id: 'c1', entries: [] } })),
      dispatch: vi.fn(),
      abandonOperation: vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null })),
      applyRecommendation: vi.fn(),
      confirmApplication: vi.fn(),
      saveDocument: vi.fn(),
      subscribeToRoom: vi.fn((_pieceId, onEvent) => {
        deliver = onEvent
        return { snapshot: Promise.resolve({ ...EMPTY_ROOM_ACTIVITY, draft: draftActivity }), unsubscribe: () => {} }
      }),
    }

    return { room, stream: (...events: readonly RoomEvent[]) => act(() => events.forEach((event) => deliver(event))) }
  }

  it('holds them for the newer action when the one it replaced settles behind it', async () => {
    const { room, stream } = streamingRoom(activitySnapshot('a1'))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', () => {}, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.actionId).toBe('a1'))

    act(() => {
      result.current.abandon()
    })
    stream({
      type: 'action.started',
      data: { actionId: 'a2', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e1', startedAt: STARTED_AT, audience: ['shape'], surface: 'draft' },
    })
    stream({ type: 'action.finished', data: { actionId: 'a1', outcome: 'abandoned', surface: 'draft' } })

    expect(result.current.busy).toBe(true)
    expect(result.current.actionId).toBe('a2')
  })

  it('releases them for an action started and finished in the same batch of frames', () => {
    const { room, stream } = streamingRoom()

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', null, () => {}, () => DOCUMENTS, room))

    stream(
      {
        type: 'action.started',
        data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e1', startedAt: STARTED_AT, audience: ['shape'], surface: 'draft' },
      },
      { type: 'action.finished', data: { actionId: 'a1', outcome: 'settled', surface: 'draft' } },
    )

    expect(result.current.busy).toBe(false)
    expect(result.current.actionId).toBeUndefined()
  })
})

describe('abandoning an operation', () => {
  function idleRoom(
    abandonOperation: RoomAdapters['abandonOperation'] = vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null })),
    draftActivity: ConversationActivitySnapshot | null = null,
  ): RoomAdapters {
    return {
      createConversation: vi.fn(),
      fetchConversation: vi.fn(() => Promise.resolve<RequestResult<{ id: string; entries: readonly ConversationEntryView[] }>>({ outcome: 'value', value: { id: 'c1', entries: [] } })),
      dispatch: vi.fn(),
      abandonOperation,
      applyRecommendation: vi.fn(),
      confirmApplication: vi.fn(),
      saveDocument: vi.fn(),
      subscribeToRoom: vi.fn(() => ({ snapshot: Promise.resolve({ ...EMPTY_ROOM_ACTIVITY, draft: draftActivity }), unsubscribe: () => {} })),
    }
  }

  it('asks the room to abandon the operation in flight, and asks nothing where there is none', async () => {
    const room = idleRoom(undefined, activitySnapshot('a1'))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', () => {}, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.actionId).toBe('a1'))

    await act(async () => {
      result.current.abandon()
    })

    expect(room.abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'a1')

    const idle = idleRoom()
    const { result: nothingInFlight } = renderHook(() => useConversation('the-lighthouse', 'draft', null, () => {}, () => DOCUMENTS, idle))

    nothingInFlight.current.abandon()

    expect(idle.abandonOperation).not.toHaveBeenCalled()
  })

  it('releases busy and the activity snapshot the instant abandon is called, before the request resolves', async () => {
    const room = idleRoom(vi.fn(() => new Promise<RequestResult<null>>(() => {})), activitySnapshot('a1'))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', () => {}, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.busy).toBe(true))

    act(() => {
      result.current.abandon()
    })

    expect(result.current.busy).toBe(false)
    expect(result.current.projection.activity).toBeUndefined()
  })

  it('reports it when the studio cannot be asked to abandon', async () => {
    const room = idleRoom(
      vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'unreachable', message: 'the studio did not answer' })),
      activitySnapshot('a1'),
    )

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', () => {}, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.actionId).toBe('a1'))

    await act(async () => {
      result.current.abandon()
    })

    await waitFor(() => expect(result.current.error).toBe('the studio did not answer'))
  })
})
