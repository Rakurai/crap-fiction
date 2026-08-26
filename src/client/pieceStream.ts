import { useCallback, useEffect, useRef } from 'react'
import type { RoomActivitySnapshot } from '../shared/conversationEvents.js'
import { isParticipantOutcome, type RoomEvent } from './entryProjection.js'
import { type subscribeToRoom as subscribeToRoomFn } from './roomClient.js'

/**
 * Mirrors the room's own activity bookkeeping for one piece from its events alone, so a surface
 * that (re)subscribes after the piece's stream first connected can be handed an accurate snapshot
 * without a second, race-prone read from the server.
 */
export function applyRoomEvent(snapshot: RoomActivitySnapshot, event: RoomEvent): RoomActivitySnapshot {
  const surface = event.data.surface
  const current = snapshot[surface]

  switch (event.type) {
    case 'action.started':
      return {
        ...snapshot,
        [surface]:
          event.data.kind === 'dispatch'
            ? {
                actionId: event.data.actionId,
                conversationId: event.data.conversationId,
                kind: 'dispatch',
                sourceEntryId: event.data.sourceEntryId,
                audience: event.data.audience,
                states: {},
                startedAt: event.data.startedAt,
              }
            : {
                actionId: event.data.actionId,
                conversationId: event.data.conversationId,
                kind: 'apply',
                sourceEntryId: event.data.sourceEntryId,
                startedAt: event.data.startedAt,
              },
      }
    case 'participant.activity': {
      if (current === null || current.kind !== 'dispatch' || current.actionId !== event.data.actionId) return snapshot
      return { ...snapshot, [surface]: { ...current, states: { ...current.states, [event.data.participantId]: event.data.state } } }
    }
    case 'apply.pending': {
      if (current === null || current.kind !== 'apply' || current.actionId !== event.data.actionId) return snapshot
      return { ...snapshot, [surface]: { ...current, applicationId: event.data.applicationId } }
    }
    case 'entry.appended': {
      if (current === null || current.kind !== 'dispatch' || current.actionId !== event.data.actionId) return snapshot
      const { entry } = event.data
      if (!isParticipantOutcome(entry)) return snapshot
      const states = { ...current.states }
      delete states[entry.participantId]
      return { ...snapshot, [surface]: { ...current, states } }
    }
    case 'action.finished':
      if (current === null || current.actionId !== event.data.actionId) return snapshot
      return { ...snapshot, [surface]: null }
    case 'error':
      return snapshot
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

export type PieceStream = Readonly<{
  subscribeToRoom: typeof subscribeToRoomFn
  close: () => void
}>

/**
 * One real event source per open piece, shared by every surface that subscribes to it. A late
 * subscriber — a surface mounting after the piece's stream already connected — is handed the
 * activity mirrored from events observed so far rather than a fresh server round-trip, which is
 * what keeps a resubscribe from racing the events it would otherwise have to wait for.
 */
export function createPieceStream(pieceId: string, subscribeToRoom: typeof subscribeToRoomFn): PieceStream {
  const listeners = new Set<Readonly<{ onEvent: (event: RoomEvent) => void; onMalformedFrame: (message: string) => void }>>()
  // Undefined until the initial snapshot resolves. An event that lands first — nothing guarantees
  // the promise settles before the next queued frame is handled — is buffered rather than applied,
  // so the snapshot can never later overwrite activity a buffered event already advanced.
  let activity: RoomActivitySnapshot | undefined = undefined
  let buffered: RoomEvent[] = []

  const real = subscribeToRoom(
    pieceId,
    (event) => {
      if (activity === undefined) {
        buffered.push(event)
      } else {
        activity = applyRoomEvent(activity, event)
      }
      for (const listener of listeners) listener.onEvent(event)
    },
    (message) => {
      for (const listener of listeners) listener.onMalformedFrame(message)
    },
  )

  // Deliberately uncaught: a snapshot that failed to arrive rejects every subscriber below rather
  // than settling this piece's activity as idle.
  const activityReady: Promise<RoomActivitySnapshot> = real.snapshot.then((initial) => {
    const settled = buffered.reduce(applyRoomEvent, initial)
    buffered = []
    activity = settled
    return settled
  })

  function subscribe(
    _pieceId: string,
    onEvent: (event: RoomEvent) => void,
    onMalformedFrame: (message: string) => void,
  ): Readonly<{ snapshot: Promise<RoomActivitySnapshot>; unsubscribe: () => void }> {
    const listener = { onEvent, onMalformedFrame }
    listeners.add(listener)
    return {
      // A fresh derivation per subscriber, not `activityReady` itself: a subscriber joining after
      // events already advanced `activity` reads the current value at the moment it asks.
      snapshot: activityReady.then(() => {
        if (activity === undefined) throw new Error('the piece stream resolved its snapshot without recording one')
        return activity
      }),
      unsubscribe: () => {
        listeners.delete(listener)
      },
    }
  }

  return { subscribeToRoom: subscribe, close: () => real.unsubscribe() }
}

/**
 * Owns the one event source for the opened piece, for as long as the piece stays open: every
 * surface's conversation subscribes through the returned adapter instead of opening its own, so
 * switching which conversation a surface is showing never reconnects the underlying stream.
 *
 * The stream is opened on first subscription and dropped when the piece closes, never held across a
 * close: a closed event source stays closed, so a stream created once and torn down on a remount
 * would leave every later subscriber listening to nothing.
 */
export function usePieceStream(pieceId: string, subscribeToRoom: typeof subscribeToRoomFn): typeof subscribeToRoomFn {
  const held = useRef<PieceStream | undefined>(undefined)

  const open = useCallback((): PieceStream => {
    held.current ??= createPieceStream(pieceId, subscribeToRoom)
    return held.current
  }, [pieceId, subscribeToRoom])

  useEffect(() => {
    open()
    return () => {
      held.current?.close()
      held.current = undefined
    }
  }, [open])

  return useCallback((id, onEvent, onMalformedFrame) => open().subscribeToRoom(id, onEvent, onMalformedFrame), [open])
}
