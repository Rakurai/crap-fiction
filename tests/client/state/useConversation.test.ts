import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationEntryView } from '../../../src/shared/conversationEntryViews.js'
import type { ConversationActivitySnapshot, DispatchActivitySnapshot, RoomActivitySnapshot } from '../../../src/shared/conversationEvents.js'
import type { DocumentSnapshot } from '../../../src/shared/surfaces.js'
import type { AutosaveState } from '../../../src/client/autosave.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomEvent } from '../../../src/client/entryProjection.js'
import { useConversation, type RoomAdapters } from '../../../src/client/useConversation.js'

const STARTED_AT = 1_700_000_000_000

const EMPTY_ROOM_ACTIVITY: RoomActivitySnapshot = { draft: null, storyContext: null, authorContext: null }
const DOCUMENTS: DocumentSnapshot = { draft: 'the draft', storyContext: 'the story context', authorContext: 'the author context' }
const NOOP_FLUSH = (): Promise<AutosaveState> => Promise.resolve({ failed: false })

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
    retrievePendingApply: vi.fn(),
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

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

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

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => {
      expect(result.current.busy).toBe(true)
      expect(result.current.projection.activity?.actionId).toBe('a1')
    })

    await answerTheConversationRead()

    await waitFor(() => {
      expect(result.current.projection.entries.map((entry) => entry.id)).toEqual(['e1'])
    })
  })

  it('stays held by an action the room reports on this surface for another conversation, and shows nothing of it', async () => {
    const { room } = roomWithHeldConversation([], { ...activitySnapshot('a1'), conversationId: 'some-other-conversation' })

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    // Learning the snapshot is what could have released the surface: before it, every surface is
    // held anyway.
    await act(async () => {})

    expect(result.current.busy).toBe(true)
    expect(result.current.projection.activity).toBeUndefined()

    act(() => {
      result.current.abandon()
    })

    expect(room.abandonOperation).not.toHaveBeenCalled()
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
      retrievePendingApply: vi.fn(),
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

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.projection.activity?.actionId).toBe('a1'))

    act(() => {
      result.current.abandon()
    })
    stream({
      type: 'action.started',
      data: { actionId: 'a2', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e1', startedAt: STARTED_AT, audience: ['shape'], surface: 'draft' },
    })
    stream({ type: 'action.finished', data: { actionId: 'a1', outcome: 'abandoned', surface: 'draft' } })

    expect(result.current.busy).toBe(true)
    expect(result.current.projection.activity?.actionId).toBe('a2')
  })

  it('releases them for an action started and finished in the same batch of frames', async () => {
    const { room, stream } = streamingRoom()

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', null, NOOP_FLUSH, () => DOCUMENTS, room))

    stream(
      {
        type: 'action.started',
        data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e1', startedAt: STARTED_AT, audience: ['shape'], surface: 'draft' },
      },
      { type: 'action.finished', data: { actionId: 'a1', outcome: 'settled', surface: 'draft' } },
    )

    await waitFor(() => expect(result.current.busy).toBe(false))
    expect(result.current.projection.activity).toBeUndefined()
  })

  it('is held by live work from another conversation without showing that conversation as its own', async () => {
    const { room, stream } = streamingRoom()
    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))
    await waitFor(() => expect(result.current.busy).toBe(false))

    stream({
      type: 'action.started',
      data: {
        actionId: 'a1',
        conversationId: 'another-conversation',
        kind: 'dispatch',
        sourceEntryId: 'e1',
        startedAt: STARTED_AT,
        audience: ['shape'],
        surface: 'draft',
      },
    })

    expect(result.current.busy).toBe(true)
    expect(result.current.projection.activity).toBeUndefined()
    stream({ type: 'action.finished', data: { actionId: 'a1', outcome: 'settled', surface: 'draft' } })

    stream({
      type: 'action.started',
      data: { actionId: 'a2', conversationId: 'another-conversation', kind: 'apply', sourceEntryId: 'e2', startedAt: STARTED_AT, surface: 'draft' },
    })

    expect(result.current.busy).toBe(true)
    expect(result.current.projection.activity).toBeUndefined()
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
      retrievePendingApply: vi.fn(),
      saveDocument: vi.fn(),
      subscribeToRoom: vi.fn(() => ({ snapshot: Promise.resolve({ ...EMPTY_ROOM_ACTIVITY, draft: draftActivity }), unsubscribe: () => {} })),
    }
  }

  it('asks the room to abandon the operation in flight, and asks nothing where there is none', async () => {
    const room = idleRoom(undefined, activitySnapshot('a1'))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.projection.activity?.actionId).toBe('a1'))

    await act(async () => {
      result.current.abandon()
    })

    expect(room.abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'a1')

    const idle = idleRoom()
    const { result: nothingInFlight } = renderHook(() => useConversation('the-lighthouse', 'draft', null, NOOP_FLUSH, () => DOCUMENTS, idle))

    nothingInFlight.current.abandon()

    expect(idle.abandonOperation).not.toHaveBeenCalled()
  })

  it('holds the surface until the studio has answered that it let the operation go', async () => {
    let letGo: () => void = () => {
      throw new Error('the studio was never asked')
    }
    const answered = new Promise<RequestResult<null>>((resolve) => {
      letGo = () => resolve({ outcome: 'value', value: null })
    })
    const room = idleRoom(vi.fn(() => answered), activitySnapshot('a1'))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.projection.activity?.actionId).toBe('a1'))

    act(() => {
      result.current.abandon()
    })

    expect(result.current.busy).toBe(true)
    expect(result.current.projection.activity?.actionId).toBe('a1')

    await act(async () => {
      letGo()
      await answered
    })

    expect(result.current.busy).toBe(false)
    expect(result.current.projection.activity).toBeUndefined()
  })

  it('reports it when the studio cannot be asked to abandon, and stays held by the operation it still has', async () => {
    const room = idleRoom(
      vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'unreachable', message: 'the studio did not answer' })),
      activitySnapshot('a1'),
    )

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.projection.activity?.actionId).toBe('a1'))

    await act(async () => {
      result.current.abandon()
    })

    await waitFor(() => expect(result.current.error).toBe('the studio did not answer'))
    expect(result.current.busy).toBe(true)
    expect(result.current.projection.activity?.actionId).toBe('a1')
  })
})

describe('resuming an Apply the room reported already in flight', () => {
  function roomWithApplyActivity(applicationId: string | undefined): RoomAdapters {
    return {
      createConversation: vi.fn(),
      fetchConversation: vi.fn(() => Promise.resolve<RequestResult<{ id: string; entries: readonly ConversationEntryView[] }>>({ outcome: 'value', value: { id: 'c1', entries: [] } })),
      dispatch: vi.fn(),
      abandonOperation: vi.fn(),
      applyRecommendation: vi.fn(),
      confirmApplication: vi.fn(),
      retrievePendingApply: vi.fn(),
      saveDocument: vi.fn(),
      subscribeToRoom: vi.fn(() => ({
        snapshot: Promise.resolve<RoomActivitySnapshot>({
          ...EMPTY_ROOM_ACTIVITY,
          draft: { actionId: 'a1', conversationId: 'c1', kind: 'apply', sourceEntryId: 'e1', startedAt: STARTED_AT, applicationId },
        }),
        unsubscribe: () => {},
      })),
    }
  }

  it('carries the provisional application identity through once the model has answered, so a reconnecting client can resume it', async () => {
    const room = roomWithApplyActivity('app1')
    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.resumedApplying).toEqual({ actionId: 'a1', responseId: 'e1', applicationId: 'app1' }))
  })

  it('reports no application identity while the model call itself is still running, with nothing yet to resume', async () => {
    const room = roomWithApplyActivity(undefined)
    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.resumedApplying).toEqual({ actionId: 'a1', responseId: 'e1', applicationId: undefined }))
  })
})

describe('a room scope whose activity is not yet known', () => {
  function roomWithSnapshot(snapshot: Promise<RoomActivitySnapshot>): RoomAdapters {
    return {
      createConversation: vi.fn(),
      fetchConversation: vi.fn(() => Promise.resolve<RequestResult<{ id: string; entries: readonly ConversationEntryView[] }>>({ outcome: 'value', value: { id: 'c1', entries: [] } })),
      dispatch: vi.fn(),
      abandonOperation: vi.fn(),
      applyRecommendation: vi.fn(),
      confirmApplication: vi.fn(),
      retrievePendingApply: vi.fn(),
      saveDocument: vi.fn(),
      subscribeToRoom: vi.fn(() => ({ snapshot, unsubscribe: () => {} })),
    }
  }

  it('is locked from the first render, before any snapshot has arrived — unknown is not idle', () => {
    const room = roomWithSnapshot(new Promise<RoomActivitySnapshot>(() => {}))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    expect(result.current.busy).toBe(true)
    result.current.sendMessage('is the opening carrying its weight')
    expect(room.dispatch).not.toHaveBeenCalled()
  })

  it('stays locked and carries the studio’s own account of why, when the activity cannot be learned at all', async () => {
    const room = roomWithSnapshot(Promise.reject(new Error('malformed "activity.snapshot" event from the studio')))

    const { result } = renderHook(() => useConversation('the-lighthouse', 'draft', 'c1', NOOP_FLUSH, () => DOCUMENTS, room))

    await waitFor(() => expect(result.current.error).toMatch(/^malformed "activity.snapshot" event from the studio —/))
    expect(result.current.busy).toBe(true)
  })
})
