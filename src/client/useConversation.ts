import { useEffect, useRef, useState } from 'react'
import type { ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import { appendEntry, EMPTY_PROJECTION, projectEvent, type ConversationProjection } from './entryProjection.js'
import type {
  abandonOperation as abandonOperationFn,
  applyRecommendation as applyRecommendationFn,
  confirmApplication as confirmApplicationFn,
  createConversation as createConversationFn,
  DispatchOpening,
  dispatch as dispatchFn,
  fetchConversation as fetchConversationFn,
  retrievePendingApply as retrievePendingApplyFn,
  subscribeToRoom as subscribeToRoomFn,
} from './roomClient.js'
import { failureMessage } from './request.js'
import type { saveSurfaceDocument as saveSurfaceDocumentFn } from './piecesClient.js'

const UNSENT = 'the message was not sent'

const ACTIVITY_UNLEARNABLE = 'this surface could not learn what the room is doing, and stays locked until it is reopened'

/**
 * The Apply this surface's activity reported already in flight when its stream connected.
 * `applicationId` is present only once the model has answered and a replacement is pending
 * confirmation — the one case a reconnecting client can resume installation and confirmation for;
 * absent it, the model call itself is still running and there is nothing yet to retrieve.
 */
export type ResumedApply = Readonly<{ actionId: string; responseId: string; applicationId: string | undefined }>

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
  /** The Apply this conversation was mid-flight on when its stream connected, if any. */
  resumedApplying: ResumedApply | undefined
}>

export type RoomAdapters = Readonly<{
  createConversation: typeof createConversationFn
  fetchConversation: typeof fetchConversationFn
  dispatch: typeof dispatchFn
  subscribeToRoom: typeof subscribeToRoomFn
  abandonOperation: typeof abandonOperationFn
  applyRecommendation: typeof applyRecommendationFn
  confirmApplication: typeof confirmApplicationFn
  retrievePendingApply: typeof retrievePendingApplyFn
  saveDocument: typeof saveSurfaceDocumentFn
}>

export function useConversation(
  pieceId: string,
  surface: SurfaceId,
  initialConversationId: string | null,
  flushDocument: () => Promise<AutosaveState>,
  getDocuments: () => DocumentSnapshot,
  room: RoomAdapters,
): ConversationViewModel {
  const { createConversation, fetchConversation, dispatch, subscribeToRoom, abandonOperation } = room
  const [projection, setProjection] = useState<ConversationProjection>(EMPTY_PROJECTION)
  const [busy, setBusy] = useState(false)
  const [actionId, setActionId] = useState<string | undefined>(undefined)
  const actionIdRef = useRef(actionId)
  const [error, setError] = useState<string | undefined>(undefined)
  const [resumedApplying, setResumedApplying] = useState<ResumedApply | undefined>(undefined)
  const conversationIdRef = useRef<string | null>(initialConversationId)
  // Held rather than read from the prop: this hook mints an id on a fresh conversation's first
  // dispatch and reports it upward, and depending on the prop would rebuild the event stream in the
  // moment that dispatch is opening. The author switching is a remount, not a changed prop.
  const [openedWithConversationId] = useState(initialConversationId)

  useEffect(() => {
    let active = true

    if (openedWithConversationId !== null) {
      void fetchConversation(pieceId, surface, openedWithConversationId).then((result) => {
        if (!active) return
        if (result.outcome === 'value') {
          setProjection((prev) =>
            prev.entries.reduce((merged, entry) => appendEntry(merged, entry), { ...prev, entries: result.value.entries }),
          )
          return
        }
        const message = failureMessage(result)
        if (message !== undefined) setError(message)
      })
    }

    const { snapshot, unsubscribe } = subscribeToRoom(
      pieceId,
      (event) => {
        if (!active || event.data.surface !== surface) return
        if (event.type === 'error') {
          setError(event.data.message)
          return
        }
        if (event.type === 'action.started') {
          actionIdRef.current = event.data.actionId
          setActionId(event.data.actionId)
          if (event.data.kind === 'dispatch') {
            conversationIdRef.current = event.data.conversationId
            setBusy(true)
          }
        }
        if (event.type === 'action.finished' && actionIdRef.current === event.data.actionId) {
          actionIdRef.current = undefined
          setActionId(undefined)
          setBusy(false)
        }
        setProjection((prev) => projectEvent(prev, event))
      },
      (message) => {
        if (active) setError(message)
      },
    )

    // The action in flight for this surface, if any, only belongs to this conversation when its
    // identity matches: this surface admits one operation at a time, but it may belong to a
    // conversation other than the one this hook opened.
    void snapshot
      .then((activity) => {
        if (!active) return
        const surfaceActivity = activity[surface]
        if (surfaceActivity === null || surfaceActivity.conversationId !== openedWithConversationId) return
        actionIdRef.current = surfaceActivity.actionId
        setActionId(surfaceActivity.actionId)
        setBusy(true)
        if (surfaceActivity.kind === 'dispatch') {
          setProjection((prev) => ({ ...prev, activity: surfaceActivity }))
        } else {
          setResumedApplying({
            actionId: surfaceActivity.actionId,
            responseId: surfaceActivity.sourceEntryId,
            applicationId: surfaceActivity.applicationId,
          })
        }
      })
      // Failing to learn what this surface's room scope is doing is an error state, never idle:
      // it locks the controls a genuine busy state would, rather than leaving them free on the
      // unproven assumption that nothing is in flight.
      .catch(() => {
        if (!active) return
        setBusy(true)
        setError(ACTIVITY_UNLEARNABLE)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [pieceId, surface, openedWithConversationId])

  function openDispatch(opening: DispatchOpening): void {
    if (busy) return
    // Started, not waited on: the current documents travel in the request either way, so the
    // dispatch never depends on this write having landed before it opens.
    void flushDocument()
    setError(undefined)
    setBusy(true)

    function stop(message: string | undefined): void {
      if (message !== undefined) setError(message)
      setBusy(false)
    }

    async function run(): Promise<void> {
      let conversationId = conversationIdRef.current
      if (conversationId === null) {
        const created = await createConversation(pieceId, surface)
        if (created.outcome !== 'value') {
          stop(failureMessage(created))
          return
        }
        conversationId = created.value.id
        conversationIdRef.current = created.value.id
      }

      const result = await dispatch(pieceId, surface, conversationId, opening, getDocuments())
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
    const target = actionId
    const conversationId = conversationIdRef.current
    if (target === undefined || conversationId === null) return
    actionIdRef.current = undefined
    setActionId(undefined)
    setBusy(false)
    setProjection((prev) => (prev.activity?.actionId === target ? { ...prev, activity: undefined } : prev))
    void abandonOperation(pieceId, surface, conversationId, target).then((result) => {
      const message = failureMessage(result)
      if (message !== undefined) setError(message)
    })
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
    resumedApplying,
  }
}
