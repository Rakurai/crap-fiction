import { act } from '@testing-library/react'
import { vi } from 'vitest'
import type { RoomEvent } from '../../src/client/entryProjection.js'
import { EMPTY_ROOM_ACTIVITY } from '../../src/client/roomClient.js'
import type { RoomAdapters } from '../../src/client/useConversation.js'
import type { ConversationEntryView } from '../../src/shared/conversationEntryViews.js'
import type { ConversationActivitySnapshot, RoomActivitySnapshot } from '../../src/shared/conversationEvents.js'

/**
 * The client's side of the room, in one place. Every way of reaching the studio is left
 * unusable rather than plausible, so a scenario that reaches one it did not state fails at
 * the reach instead of passing on harness data.
 */
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

/** The conversation a scenario says is already on disk. */
export function conversationOnDisk(id: string, entries: readonly ConversationEntryView[]): RoomAdapters['fetchConversation'] {
  return vi.fn(() => Promise.resolve({ outcome: 'value' as const, value: { id, entries } }))
}

/** What the room reports in flight, where only the draft surface is holding anything. */
export function onTheDraft(activity: ConversationActivitySnapshot | null): Promise<RoomActivitySnapshot> {
  return Promise.resolve({ ...EMPTY_ROOM_ACTIVITY, draft: activity })
}

export type RoomStream = Readonly<{
  subscribeToRoom: RoomAdapters['subscribeToRoom']
  /** Delivers frames to the subscriber, in order, as the studio's stream would. */
  stream: (...events: readonly RoomEvent[]) => void
}>

/** A subscription the test drives, reporting the activity the scenario stated. */
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
