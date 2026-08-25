import { useEffect, useRef, useState } from 'react'
import type { ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { DispatchActivitySnapshot } from '../shared/conversationEvents.js'
import {
  appendEntry,
  EMPTY_PROJECTION,
  initialProjection,
  projectEvent,
  withDispatchInFlight,
  type ConversationProjection,
} from './entryProjection.js'
import type {
  abandonOperation as abandonOperationFn,
  applyRecommendation as applyRecommendationFn,
  createConversation as createConversationFn,
  DispatchOpening,
  dispatch as dispatchFn,
  fetchConversation as fetchConversationFn,
  subscribeToRoom as subscribeToRoomFn,
} from './roomClient.js'
import { failureMessage } from './request.js'

const UNSENT = 'the message was not sent'

export type ConversationViewModel = Readonly<{
  projection: ConversationProjection
  busy: boolean
  error: string | undefined
  sendMessage: (message: string) => void
  reply: (participantId: string, message: string) => void
  askForConcreteChange: (respondingTo: string, clarification: string | undefined) => void
  abandon: () => void
  conversationId: string | null
  attachEntry: (entry: ConversationEntryView) => void
}>

export type RoomAdapters = Readonly<{
  createConversation: typeof createConversationFn
  fetchConversation: typeof fetchConversationFn
  dispatch: typeof dispatchFn
  subscribeToRoom: typeof subscribeToRoomFn
  abandonOperation: typeof abandonOperationFn
  applyRecommendation: typeof applyRecommendationFn
}>

export function useConversation(
  pieceId: string,
  initialConversationId: string | null,
  initialActivity: DispatchActivitySnapshot | null,
  flushDraft: () => void,
  getDraft: () => string,
  room: RoomAdapters,
): ConversationViewModel {
  const { createConversation, fetchConversation, dispatch, subscribeToRoom, abandonOperation } = room
  const [projection, setProjection] = useState<ConversationProjection>(() =>
    initialActivity === null ? EMPTY_PROJECTION : withDispatchInFlight(EMPTY_PROJECTION, initialActivity),
  )
  const [busy, setBusy] = useState(initialActivity !== null)
  const [error, setError] = useState<string | undefined>(undefined)
  const conversationIdRef = useRef<string | null>(initialConversationId)
  // Held rather than read from the prop below: this hook mints an id on a fresh conversation's
  // first dispatch and reports it upward, and depending on the prop would rebuild the event stream
  // in the moment that dispatch is opening. The author switching is a remount, not a changed prop.
  const [openedWithConversationId] = useState(initialConversationId)

  useEffect(() => {
    let active = true

    if (openedWithConversationId !== null) {
      void fetchConversation(pieceId, openedWithConversationId).then((result) => {
        if (!active) return
        if (result.outcome === 'value') {
          const loaded = initialProjection(result.value.entries)
          setProjection((prev) => ({ ...prev, entries: [...loaded.entries, ...prev.entries] }))
          return
        }
        const message = failureMessage(result)
        if (message !== undefined) setError(message)
      })
    }

    const unsubscribe = subscribeToRoom(
      pieceId,
      (event) => {
        if (!active) return
        if (event.type === 'error') {
          setError(event.data.message)
          return
        }
        if (event.type === 'action.started' && event.data.kind === 'dispatch') {
          conversationIdRef.current = event.data.conversationId
          setBusy(true)
        }
        if (event.type === 'action.finished') setBusy(false)
        setProjection((prev) => projectEvent(prev, event))
      },
      (message) => {
        if (active) setError(message)
      },
    )

    return () => {
      active = false
      unsubscribe()
    }
  }, [pieceId, openedWithConversationId])

  function openDispatch(opening: DispatchOpening): void {
    if (busy) return
    flushDraft()
    setError(undefined)
    setBusy(true)

    function stop(message: string | undefined): void {
      if (message !== undefined) setError(message)
      setBusy(false)
    }

    async function run(): Promise<void> {
      let conversationId = conversationIdRef.current
      if (conversationId === null) {
        const created = await createConversation(pieceId)
        if (created.outcome !== 'value') {
          stop(failureMessage(created))
          return
        }
        conversationId = created.value.id
        conversationIdRef.current = created.value.id
      }

      const result = await dispatch(pieceId, conversationId, opening, getDraft())
      if (result.outcome !== 'value') stop(failureMessage(result))
    }

    void run().catch((err: unknown) => {
      stop(err instanceof Error ? err.message : UNSENT)
    })
  }

  function sendMessage(message: string): void {
    openDispatch({ message })
  }

  function reply(participantId: string, message: string): void {
    openDispatch({ target: participantId, message })
  }

  function askForConcreteChange(respondingTo: string, clarification: string | undefined): void {
    openDispatch({ respondingTo, clarification })
  }

  function abandon(): void {
    if (!busy) return
    void abandonOperation(pieceId).then((result) => {
      const message = failureMessage(result)
      if (message !== undefined) setError(message)
    })
  }

  function attachEntry(entry: ConversationEntryView): void {
    setProjection((prev) => appendEntry(prev, entry))
  }

  return {
    projection,
    busy,
    error,
    sendMessage,
    reply,
    askForConcreteChange,
    abandon,
    conversationId: conversationIdRef.current,
    attachEntry,
  }
}
