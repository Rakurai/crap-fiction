import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { RoomEvent } from '../../src/client/entryProjection.js'
import { EMPTY_ROOM_ACTIVITY } from '../../src/client/roomClient.js'
import type { RoomAdapters } from '../../src/client/useConversation.js'
import type { ConversationEntryView } from '../../src/shared/conversationEntryViews.js'
import type { ConversationActivitySnapshot, RoomActivitySnapshot } from '../../src/shared/conversationEvents.js'

const UNREACHED = 'unreached: this scenario never stated what the room does when asked to'

export function roomAdapters(overrides: Partial<RoomAdapters> = {}): RoomAdapters {
  const unreached = <K extends keyof RoomAdapters>(name: K): RoomAdapters[K] =>
    vi.fn(() => {
      throw new Error(`${UNREACHED} ${name}`)
    }) as unknown as RoomAdapters[K]

  return {
    createConversation: unreached('createConversation'),
    fetchConversation: unreached('fetchConversation'),
    dispatch: unreached('dispatch'),
    subscribeToRoom: unreached('subscribeToRoom'),
    abandonOperation: unreached('abandonOperation'),
    applyRecommendation: unreached('applyRecommendation'),
    confirmApplication: unreached('confirmApplication'),
    retrievePendingApply: unreached('retrievePendingApply'),
    saveDocument: unreached('saveDocument'),
    ...overrides,
  }
}

export function conversationOnDisk(id: string, entries: readonly ConversationEntryView[]): RoomAdapters['fetchConversation'] {
  return vi.fn(() => Promise.resolve({ outcome: 'value' as const, value: { id, entries } }))
}

export function onTheDraft(activity: ConversationActivitySnapshot | null): Promise<RoomActivitySnapshot> {
  return Promise.resolve({ ...EMPTY_ROOM_ACTIVITY, draft: activity })
}

export type RoomStream = Readonly<{
  subscribeToRoom: RoomAdapters['subscribeToRoom']
  stream: (...events: readonly RoomEvent[]) => void
}>

export function roomStream(snapshot: Promise<RoomActivitySnapshot>): RoomStream {
  let deliver: (event: RoomEvent) => void = () => {
    throw new Error('the room was never subscribed to')
  }

  return {
    subscribeToRoom: vi.fn((_pieceId, onEvent) => {
      deliver = onEvent
      return { snapshot, unsubscribe: () => {} }
    }),
    stream: (...events) =>
      act(() => {
        events.forEach((event) => deliver(event))
      }),
  }
}
