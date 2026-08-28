import { render } from '@testing-library/react'
import { createElement, StrictMode, useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { applyRoomEvent, createPieceStream, usePieceStream } from '../../src/client/pieceStream.js'
import { applyDispatchEvent } from '../../src/client/entryProjection.js'
import type { RoomEvent } from '../../src/shared/conversationEvents.js'
import { EMPTY_ROOM_ACTIVITY as EMPTY, type subscribeToRoom as subscribeToRoomFn } from '../../src/client/roomClient.js'

const STARTED: RoomEvent = {
  type: 'action.started',
  data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e0', startedAt: 1, audience: ['shape'], surface: 'draft' },
}

describe('applyRoomEvent', () => {
  it('mirrors a dispatch from its start, through a participant reporting and answering, to its finish — scoped to the surface the event names', () => {
    let snapshot = applyRoomEvent(EMPTY, STARTED)
    expect(snapshot.draft).toMatchObject({ actionId: 'a1', kind: 'dispatch', states: {} })
    expect(snapshot.storyContext).toBeNull()

    snapshot = applyRoomEvent(snapshot, {
      type: 'participant.activity',
      data: { actionId: 'a1', participantId: 'shape', state: 'working', startedAt: 1, surface: 'draft' },
    })
    expect(snapshot.draft).toMatchObject({ states: { shape: { state: 'working', startedAt: 1 } } })

    snapshot = applyRoomEvent(snapshot, {
      type: 'entry.appended',
      data: { actionId: 'a1', entry: { id: 'e1', kind: 'participantResponse', participantId: 'shape', causeId: 'e0', outcome: 'commentary', claim: 'It holds.' }, surface: 'draft' },
    })
    expect(snapshot.draft).toMatchObject({ states: {} })

    snapshot = applyRoomEvent(snapshot, { type: 'action.finished', data: { actionId: 'a1', outcome: 'settled', surface: 'draft' } })
    expect(snapshot.draft).toBeNull()
  })

  it('ignores progress and completion naming an action no longer current for that surface', () => {
    const snapshot = applyRoomEvent(EMPTY, { type: 'action.finished', data: { actionId: 'a-stale', outcome: 'abandoned', surface: 'draft' } })
    expect(snapshot).toEqual(EMPTY)
  })

  it('folds a dispatch onto a surface the same way a resubscribed room snapshot and a live conversation projection each fold it', () => {
    const events: RoomEvent[] = [
      STARTED,
      { type: 'participant.activity', data: { actionId: 'a1', participantId: 'shape', state: 'working', startedAt: 1, surface: 'draft' } },
      {
        type: 'entry.appended',
        data: { actionId: 'a1', entry: { id: 'e1', kind: 'participantResponse', participantId: 'shape', causeId: 'e0', outcome: 'commentary', claim: 'It holds.' }, surface: 'draft' },
      },
    ]

    const snapshot = events.reduce(applyRoomEvent, EMPTY)
    const directly = events.reduce<ReturnType<typeof applyDispatchEvent>>((activity, event) => applyDispatchEvent(activity, event), undefined)

    expect(snapshot.draft).toEqual(directly)
  })
})

describe('createPieceStream', () => {
  function fakeSubscribe(): { subscribeToRoom: typeof subscribeToRoomFn; deliver: (event: RoomEvent) => void; resolveSnapshot: () => void } {
    let deliver: (event: RoomEvent) => void = () => {}
    let resolveSnapshot: () => void = () => {}
    const subscribeToRoom: typeof subscribeToRoomFn = (_pieceId, onEvent) => {
      deliver = onEvent
      return { snapshot: new Promise((resolve) => (resolveSnapshot = () => resolve(EMPTY))), unsubscribe: () => {} }
    }
    return { subscribeToRoom, deliver: (event) => deliver(event), resolveSnapshot: () => resolveSnapshot() }
  }

  it('hands a subscriber that joins after the piece connected the activity mirrored from events observed since, not a fresh server round trip', async () => {
    const fake = fakeSubscribe()
    const stream = createPieceStream('the-lighthouse', fake.subscribeToRoom)
    fake.resolveSnapshot()

    const first = stream.subscribeToRoom('the-lighthouse', () => {}, () => {})
    await expect(first.snapshot).resolves.toEqual(EMPTY)

    fake.deliver(STARTED)
    const second = stream.subscribeToRoom('the-lighthouse', () => {}, () => {})

    await expect(second.snapshot).resolves.toMatchObject({ draft: { actionId: 'a1' } })
  })

  it('keeps an event that arrives before the initial snapshot settles rather than letting the snapshot overwrite it once it resolves', async () => {
    const fake = fakeSubscribe()
    const stream = createPieceStream('the-lighthouse', fake.subscribeToRoom)

    const subscription = stream.subscribeToRoom('the-lighthouse', () => {}, () => {})
    fake.deliver(STARTED)
    fake.resolveSnapshot()

    await expect(subscription.snapshot).resolves.toMatchObject({ draft: { actionId: 'a1' } })
  })

  it('propagates a snapshot that failed to arrive to every subscriber rather than substituting an empty one', async () => {
    let rejectSnapshot: (err: unknown) => void = () => {}
    const subscribeToRoom: typeof subscribeToRoomFn = () => ({
      snapshot: new Promise((_resolve, reject) => (rejectSnapshot = reject)),
      unsubscribe: () => {},
    })
    const stream = createPieceStream('the-lighthouse', subscribeToRoom)

    const subscription = stream.subscribeToRoom('the-lighthouse', () => {}, () => {})
    rejectSnapshot(new Error('malformed "activity.snapshot" event from the studio'))

    await expect(subscription.snapshot).rejects.toThrow('malformed "activity.snapshot" event from the studio')
  })

  it('delivers a live event to every current listener, and stops delivering to one that unsubscribed', () => {
    const fake = fakeSubscribe()
    const stream = createPieceStream('the-lighthouse', fake.subscribeToRoom)

    const seenByFirst: RoomEvent[] = []
    const seenBySecond: RoomEvent[] = []
    const first = stream.subscribeToRoom('the-lighthouse', (event) => seenByFirst.push(event), () => {})
    stream.subscribeToRoom('the-lighthouse', (event) => seenBySecond.push(event), () => {})

    first.unsubscribe()
    fake.deliver(STARTED)

    expect(seenByFirst).toEqual([])
    expect(seenBySecond).toEqual([STARTED])
  })
})

describe('usePieceStream', () => {
  it('holds an open stream for a surface that subscribes after the piece was mounted, torn down and mounted again', () => {
    const sources: { closed: boolean; onEvent: (event: RoomEvent) => void }[] = []
    const subscribeToRoom: typeof subscribeToRoomFn = (_pieceId, onEvent) => {
      const source = { closed: false, onEvent }
      sources.push(source)
      return {
        snapshot: Promise.resolve(EMPTY),
        unsubscribe: () => {
          source.closed = true
        },
      }
    }

    const seen: RoomEvent[] = []

    function Surface({ subscribe }: { readonly subscribe: typeof subscribeToRoomFn }) {
      useEffect(() => subscribe('the-lighthouse', (event) => seen.push(event), () => {}).unsubscribe, [subscribe])
      return null
    }

    function Piece() {
      return createElement(Surface, { subscribe: usePieceStream('the-lighthouse', subscribeToRoom) })
    }

    render(createElement(StrictMode, null, createElement(Piece, null)))

    const live = sources.filter((source) => !source.closed)
    expect(live).toHaveLength(1)
    live[0]?.onEvent(STARTED)
    expect(seen).toEqual([STARTED])
  })
})
