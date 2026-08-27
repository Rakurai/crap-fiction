import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { ActionKind, ConversationActivitySnapshot, RoomActivitySnapshot } from '../shared/conversationEvents.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import { appendEntry, EMPTY_PROJECTION, projectEvent, type ConversationProjection, type RoomEvent } from './entryProjection.js'
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

export type ResumedApply = Readonly<{ actionId: string; responseId: string; applicationId: string | undefined }>

type SurfaceOperation = Readonly<{
  actionId: string
  conversationId: string
  kind: ActionKind
  sourceEntryId: string
  applicationId: string | undefined
}>

type SurfaceState = Readonly<{
  operation: SurfaceOperation | undefined
  opening: boolean
  activityStatus: 'learning' | 'known' | 'failed'
  projection: ConversationProjection
  mine: string | null
  error: string | undefined
}>

type SurfaceChange =
  | Readonly<{ type: 'event'; event: RoomEvent }>
  | Readonly<{ type: 'entriesRead'; entries: readonly ConversationEntryView[] }>
  | Readonly<{ type: 'activityLearned'; activity: ConversationActivitySnapshot | null }>
  | Readonly<{ type: 'activityUnlearnable'; message: string }>
  | Readonly<{ type: 'minted'; conversationId: string }>
  | Readonly<{ type: 'opening' }>
  | Readonly<{ type: 'stopped'; message: string | undefined }>
  | Readonly<{ type: 'reported'; message: string }>
  | Readonly<{ type: 'abandoned'; actionId: string }>

function operationOf(activity: ConversationActivitySnapshot): SurfaceOperation {
  return {
    actionId: activity.actionId,
    conversationId: activity.conversationId,
    kind: activity.kind,
    sourceEntryId: activity.sourceEntryId,
    applicationId: activity.kind === 'apply' ? activity.applicationId : undefined,
  }
}

function reduceEvent(state: SurfaceState, event: RoomEvent): SurfaceState {
  const { operation } = state
  switch (event.type) {
    case 'error':
      return { ...state, error: event.data.message }
    case 'action.started': {
      const started: SurfaceOperation = {
        actionId: event.data.actionId,
        conversationId: event.data.conversationId,
        kind: event.data.kind,
        sourceEntryId: event.data.sourceEntryId,
        applicationId: undefined,
      }
      return {
        ...state,
        opening: false,
        operation: started,
        projection: started.conversationId === state.mine ? projectEvent(state.projection, event) : state.projection,
      }
    }
    case 'apply.pending': {
      if (operation?.actionId !== event.data.actionId) return state
      return { ...state, operation: { ...operation, applicationId: event.data.applicationId } }
    }
    case 'action.finished': {
      if (operation?.actionId !== event.data.actionId) return { ...state, projection: projectEvent(state.projection, event) }
      return {
        ...state,
        operation: undefined,
        projection: operation.conversationId === state.mine ? projectEvent(state.projection, event) : state.projection,
      }
    }
    default: {
      if (operation?.actionId === event.data.actionId && operation.conversationId !== state.mine) return state
      return { ...state, projection: projectEvent(state.projection, event) }
    }
  }
}

function reduce(state: SurfaceState, change: SurfaceChange): SurfaceState {
  switch (change.type) {
    case 'event':
      return reduceEvent(state, change.event)
    case 'entriesRead': {
      const merged = state.projection.entries.reduce((projection, entry) => appendEntry(projection, entry), {
        ...state.projection,
        entries: change.entries,
      })
      return { ...state, projection: merged }
    }
    case 'activityLearned': {
      const { activity } = change
      if (activity === null) return { ...state, activityStatus: 'known' }
      const operation = operationOf(activity)
      const showable = operation.conversationId === state.mine && activity.kind === 'dispatch'
      return {
        ...state,
        activityStatus: 'known',
        operation,
        projection: showable ? { ...state.projection, activity } : state.projection,
      }
    }
    case 'activityUnlearnable':
      return { ...state, activityStatus: 'failed', error: change.message }
    case 'minted':
      return { ...state, mine: change.conversationId }
    case 'opening':
      return { ...state, opening: true, error: undefined }
    case 'stopped':
      return { ...state, opening: false, error: change.message ?? state.error }
    case 'reported':
      return { ...state, error: change.message }
    case 'abandoned': {
      if (state.operation?.actionId !== change.actionId) return state
      return {
        ...state,
        operation: undefined,
        projection: state.projection.activity?.actionId === change.actionId ? { ...state.projection, activity: undefined } : state.projection,
      }
    }
    default: {
      const exhaustive: never = change
      return exhaustive
    }
  }
}

export type ConversationViewModel = Readonly<{
  projection: ConversationProjection
  busy: boolean
  applyingInRoom: boolean
  error: string | undefined
  sendMessage: (message: string) => void
  reply: (participantId: string, message: string) => void
  askForConcreteChange: (respondingTo: string, clarification: string | undefined) => void
  abandon: () => Promise<boolean>
  abandonAction: (conversationId: string, actionId: string, after: string | undefined) => Promise<boolean>
  conversationId: string | null
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
  const [state, update] = useReducer(reduce, {
    operation: undefined,
    opening: false,
    activityStatus: 'learning',
    projection: EMPTY_PROJECTION,
    mine: initialConversationId,
    error: undefined,
  })
  const abandoningRef = useRef(false)
  const mounted = useRef(true)
  const actionController = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    return () => {
      mounted.current = false
      actionController.current?.abort()
    }
  }, [])
  // Held rather than read from the prop: this hook mints an id on a fresh conversation's first
  // dispatch and reports it upward, and depending on the prop would rebuild the event stream in the
  // moment that dispatch is opening. The author switching is a remount, not a changed prop.
  const [openedWithConversationId] = useState(initialConversationId)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    if (openedWithConversationId !== null) {
      void fetchConversation(pieceId, surface, openedWithConversationId, controller.signal).then((result) => {
        if (!active) return
        if (result.outcome === 'value') {
          update({ type: 'entriesRead', entries: result.value.entries })
          return
        }
        const message = failureMessage(result)
        if (message !== undefined) update({ type: 'reported', message })
      })
    }

    function learnActivity(activityPromise: Promise<RoomActivitySnapshot>, cleanup?: () => void): void {
      void activityPromise
        .then((activity) => {
          cleanup?.()
          if (!active) return
          update({ type: 'activityLearned', activity: activity[surface] })
        })
        .catch((err: unknown) => {
          cleanup?.()
          if (!active) return
          update({ type: 'activityUnlearnable', message: `${err instanceof Error ? err.message : String(err)} — ${STAYS_LOCKED}` })
        })
    }

    const { snapshot, unsubscribe } = subscribeToRoom(
      pieceId,
      (event) => {
        if (!active || event.data.surface !== surface) return
        update({ type: 'event', event })
      },
      (message) => {
        if (!active) return
        update({ type: 'reported', message })
        const peek = subscribeToRoom(pieceId, () => {}, () => {})
        learnActivity(peek.snapshot, peek.unsubscribe)
      },
    )

    learnActivity(snapshot)

    return () => {
      active = false
      controller.abort()
      unsubscribe()
    }
  }, [pieceId, surface, openedWithConversationId])

  const roomBusy = state.opening || state.operation !== undefined || state.activityStatus !== 'known'

  function openDispatch(opening: DispatchOpening): void {
    if (roomBusy) return
    void flushDocument()
    update({ type: 'opening' })
    const controller = new AbortController()
    actionController.current = controller

    async function run(): Promise<void> {
      let conversationId = state.mine
      if (conversationId === null) {
        const created = await createConversation(pieceId, surface, controller.signal)
        if (!mounted.current) return
        if (created.outcome !== 'value') {
          update({ type: 'stopped', message: failureMessage(created) })
          return
        }
        conversationId = created.value.id
        update({ type: 'minted', conversationId })
      }

      const result = await dispatch(pieceId, surface, conversationId, opening, getDocuments(), controller.signal)
      if (!mounted.current) return
      if (result.outcome !== 'value') update({ type: 'stopped', message: failureMessage(result) })
    }

    void run().catch((err: unknown) => {
      if (!mounted.current) return
      update({ type: 'stopped', message: err instanceof Error ? err.message : UNSENT })
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

  async function abandonAction(conversationId: string, actionId: string, after: string | undefined): Promise<boolean> {
    if (abandoningRef.current) return false
    abandoningRef.current = true
    const controller = new AbortController()
    actionController.current = controller
    const result = await abandonOperation(pieceId, surface, conversationId, actionId, controller.signal)
    abandoningRef.current = false
    if (!mounted.current) return false
    const unfreed = failureMessage(result)
    if (unfreed !== undefined) {
      update({ type: 'reported', message: after === undefined ? unfreed : `${after} — ${unfreed}` })
      return false
    }
    update({ type: 'abandoned', actionId })
    return true
  }

  async function abandon(): Promise<boolean> {
    const { operation } = state
    if (operation === undefined) return false
    return await abandonAction(operation.conversationId, operation.actionId, undefined)
  }

  const resumedApplying = useMemo((): ResumedApply | undefined => {
    const { operation } = state
    if (operation === undefined || operation.kind !== 'apply' || operation.conversationId !== state.mine) return undefined
    return { actionId: operation.actionId, responseId: operation.sourceEntryId, applicationId: operation.applicationId }
  }, [state.operation, state.mine])

  return {
    projection: state.projection,
    busy: roomBusy,
    applyingInRoom: state.operation?.kind === 'apply',
    error: state.error,
    sendMessage,
    reply,
    askForConcreteChange,
    abandon,
    abandonAction,
    conversationId: state.mine,
    resumedApplying,
  }
}
