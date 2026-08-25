import { useEffect, useRef, useState } from 'react'
import type { ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { ConversationActivitySnapshot } from '../shared/conversationEvents.js'
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
  actionId: string | undefined
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
  initialActivity: ConversationActivitySnapshot | null,
  flushDraft: () => void,
  getDraft: () => string,
  room: RoomAdapters,
): ConversationViewModel {
  const { createConversation, fetchConversation, dispatch, subscribeToRoom, abandonOperation } = room
  const [projection, setProjection] = useState<ConversationProjection>(() =>
    initialActivity?.kind === 'dispatch' ? withDispatchInFlight(EMPTY_PROJECTION, initialActivity) : EMPTY_PROJECTION,
  )
  const [busy, setBusy] = useState(initialActivity?.kind === 'dispatch')
  // Tracks whichever conversation action — dispatch or apply — is currently open, regardless of
  // kind: the two never overlap, and Abandon targets this identity either way rather than owning a
  // separate notion of "the current apply" alongside "the current dispatch".
  const [actionId, setActionId] = useState<string | undefined>(initialActivity?.actionId)
  const [error, setError] = useState<string | undefined>(undefined)
  // Falls back to the activity snapshot's own conversation: an action in flight is proof a
  // conversation already exists, so a reload that reports one always knows which without waiting
  // for the separate conversation fetch this hook also kicks off.
  const conversationIdRef = useRef<string | null>(initialConversationId ?? initialActivity?.conversationId ?? null)
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
        if (event.type === 'action.started') {
          setActionId(event.data.actionId)
          if (event.data.kind === 'dispatch') {
            conversationIdRef.current = event.data.conversationId
            setBusy(true)
          }
        }
        if (event.type === 'action.finished') {
          setActionId((current) => (current === event.data.actionId ? undefined : current))
          setBusy(false)
        }
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

  // Targets whatever action is currently tracked by identity, dispatch or apply alike, and releases
  // this hook's own controls the instant it is called rather than waiting on the request: ABANDON-
  // UNTRACK is a property of the room the request asks it to honour, not something this client can
  // observe over the network any sooner than "it accepted the request".
  function abandon(): void {
    const target = actionId
    const conversationId = conversationIdRef.current
    if (target === undefined || conversationId === null) return
    setActionId(undefined)
    setBusy(false)
    setProjection((prev) => (prev.activity?.actionId === target ? { ...prev, activity: undefined } : prev))
    void abandonOperation(pieceId, conversationId, target).then((result) => {
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
    actionId,
    attachEntry,
  }
}
