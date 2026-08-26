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

const STAYS_LOCKED = 'this surface stays locked until it is reopened'

/**
 * The Apply this surface's activity reported already in flight when its stream connected.
 * `applicationId` is present only once the model has answered and a replacement is pending
 * confirmation — the one case a reconnecting client can resume installation and confirmation for;
 * absent it, the model call itself is still running and there is nothing yet to retrieve.
 */
export type ResumedApply = Readonly<{ actionId: string; responseId: string; applicationId: string | undefined }>

export type ConversationViewModel = Readonly<{
  projection: ConversationProjection
  /**
   * Whether the room is the author's to address. False only while this surface knows its room scope
   * is idle: an action in flight, activity not yet learned, and activity that could not be learned
   * all read the same way to a control, because none of them is an idle room.
   */
  busy: boolean
  /** Whether this surface's authoritative room scope is applying, whichever conversation owns it. */
  applyingInRoom: boolean
  error: string | undefined
  sendMessage: (message: string) => void
  reply: (participantId: string, message: string) => void
  askForConcreteChange: (respondingTo: string, clarification: string | undefined) => void
  /** Resolves true only when the room authoritatively released this conversation's operation. */
  abandon: () => Promise<boolean>
  conversationId: string | null
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
  // Until the room's own activity has arrived, what this surface has in flight is unknown rather
  // than nothing, and unknown locks the surface exactly as an action in flight does.
  const [activityStatus, setActivityStatus] = useState<'learning' | 'known' | 'failed'>('learning')
  const [busy, setBusy] = useState(false)
  const [applyingInRoom, setApplyingInRoom] = useState(false)
  const [actionId, setActionId] = useState<string | undefined>(undefined)
  const actionIdRef = useRef(actionId)
  // Whether the action this surface holds was opened in the conversation this hook is showing. Only
  // its own is this hook's to abandon; another conversation's still holds the surface's controls.
  const ownActionRef = useRef(false)
  const abandoningRef = useRef(false)
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
          ownActionRef.current = event.data.conversationId === conversationIdRef.current
          actionIdRef.current = event.data.actionId
          setActionId(event.data.actionId)
          setBusy(true)
          setApplyingInRoom(event.data.kind === 'apply')
          if (ownActionRef.current) setProjection((prev) => projectEvent(prev, event))
          return
        }
        if (event.type === 'apply.pending' && actionIdRef.current === event.data.actionId) {
          if (ownActionRef.current) {
            setResumedApplying({
              actionId: event.data.actionId,
              responseId: event.data.sourceEntryId,
              applicationId: event.data.applicationId,
            })
          }
          return
        }
        if (event.type === 'action.finished' && actionIdRef.current === event.data.actionId) {
          const ownAction = ownActionRef.current
          actionIdRef.current = undefined
          ownActionRef.current = false
          abandoningRef.current = false
          setActionId(undefined)
          setBusy(false)
          setApplyingInRoom(false)
          setResumedApplying(undefined)
          if (ownAction) setProjection((prev) => projectEvent(prev, event))
          return
        }
        if ('actionId' in event.data && actionIdRef.current === event.data.actionId && !ownActionRef.current) return
        setProjection((prev) => projectEvent(prev, event))
      },
      // A frame this client cannot read is reported and otherwise passed over. Only the snapshot's
      // own failure locks the surface, and it says so where it is awaited: a malformed frame of any
      // other kind leaves what the room is doing already learned.
      (message) => {
        if (active) setError(message)
      },
    )

    // A surface admits one operation at a time, so whatever the room reports in flight here holds
    // this surface's controls whichever conversation opened it — the room would refuse a dispatch
    // from this one either way. Only an action opened in this conversation is shown in it, or
    // resumed by it.
    void snapshot
      .then((activity) => {
        if (!active) return
        setActivityStatus('known')
        const surfaceActivity = activity[surface]
        if (surfaceActivity === null) {
          setApplyingInRoom(false)
          return
        }
        actionIdRef.current = surfaceActivity.actionId
        ownActionRef.current = surfaceActivity.conversationId === openedWithConversationId
        setActionId(surfaceActivity.actionId)
        setBusy(true)
        setApplyingInRoom(surfaceActivity.kind === 'apply')
        if (!ownActionRef.current) return
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
      // Terminal: the surface never learns what its room scope is doing, so it stays locked for the
      // life of this mount and says why in the studio's own words rather than a substitute of ours.
      .catch((err: unknown) => {
        if (!active) return
        setActivityStatus('failed')
        setError(`${err instanceof Error ? err.message : String(err)} — ${STAYS_LOCKED}`)
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [pieceId, surface, openedWithConversationId])

  const roomBusy = busy || activityStatus !== 'known'

  function openDispatch(opening: DispatchOpening): void {
    if (roomBusy) return
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

  // The controls are the author's again only once the studio has answered that it let the action go.
  // Releasing them on the request would show an idle surface the room is still working on, and a
  // failed abandonment would leave that surface addressable and every dispatch from it refused.
  async function abandon(): Promise<boolean> {
    const target = actionId
    const conversationId = conversationIdRef.current
    if (target === undefined || conversationId === null || !ownActionRef.current || abandoningRef.current) return false
    abandoningRef.current = true
    const result = await abandonOperation(pieceId, surface, conversationId, target)
    const message = failureMessage(result)
    if (message !== undefined) {
      abandoningRef.current = false
      setError(message)
      return false
    }
    if (actionIdRef.current === target) {
      actionIdRef.current = undefined
      ownActionRef.current = false
      abandoningRef.current = false
      setActionId(undefined)
      setBusy(false)
      setProjection((prev) => (prev.activity?.actionId === target ? { ...prev, activity: undefined } : prev))
    }
    return true
  }

  return {
    projection,
    busy: roomBusy,
    applyingInRoom,
    error,
    sendMessage,
    reply,
    askForConcreteChange,
    abandon,
    conversationId: conversationIdRef.current,
    resumedApplying,
  }
}
