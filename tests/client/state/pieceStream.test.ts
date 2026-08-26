import { describe, expect, it } from 'vitest'
import { applyRoomEvent, createPieceStream } from '../../../src/client/pieceStream.js'
import type { RoomEvent } from '../../../src/client/entryProjection.js'
import { EMPTY_ROOM_ACTIVITY as EMPTY, type subscribeToRoom as subscribeToRoomFn } from '../../../src/client/roomClient.js'

const STARTED: RoomEvent = {
  type: 'action.started',
  data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e0', startedAt: 1, audience: ['shape'], surface: 'draft' },
}

describe('applyRoomEvent', () => {
  it('mirrors a dispatch from its start, through a participant reporting and answering, to its finish — scoped to the surface the event names', () => {
    let snapshot = applyRoomEvent(EMPTY, STARTED)
    expect(snapshot.draft).toMatchObject({ actionId: 'a1', kind: 'dispatch', states: {} })
    expect(snapshot.storyContext).toBeNull()

    snapshot = applyRoomEvent(snapshot, { type: 'participant.activity', data: { actionId: 'a1', participantId: 'shape', state: 'working', surface: 'draft' } })
    expect(snapshot.draft).toMatchObject({ states: { shape: 'working' } })

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
