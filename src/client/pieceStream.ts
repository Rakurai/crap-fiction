import { useCallback, useEffect, useRef } from 'react'
import type { RoomActivitySnapshot } from '../shared/conversationEvents.js'
import { applyDispatchEvent } from './entryProjection.js'
import type { RoomEvent } from '../shared/conversationEvents.js'
import { type subscribeToRoom as subscribeToRoomFn } from './roomClient.js'

export function applyRoomEvent(snapshot: RoomActivitySnapshot, event: RoomEvent): RoomActivitySnapshot {
  const surface = event.data.surface
  const current = snapshot[surface]

  switch (event.type) {
    case 'action.started':
      return {
        ...snapshot,
        [surface]:
          event.data.kind === 'dispatch'
            ? applyDispatchEvent(undefined, event) ?? null
            : {
                actionId: event.data.actionId,
                conversationId: event.data.conversationId,
                kind: 'apply',
                sourceEntryId: event.data.sourceEntryId,
                startedAt: event.data.startedAt,
              },
      }
    case 'participant.activity':
    case 'entry.appended': {
      if (current === null || current.kind !== 'dispatch') return snapshot
      const next = applyDispatchEvent(current, event)
      return next === current ? snapshot : { ...snapshot, [surface]: next ?? null }
    }
    case 'apply.pending': {
      if (current === null || current.kind !== 'apply' || current.actionId !== event.data.actionId) return snapshot
      return { ...snapshot, [surface]: { ...current, applicationId: event.data.applicationId } }
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

export function createPieceStream(pieceId: string, subscribeToRoom: typeof subscribeToRoomFn): PieceStream {
  const listeners = new Set<Readonly<{ onEvent: (event: RoomEvent) => void; onMalformedFrame: (message: string) => void }>>()
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
