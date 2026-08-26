import { z } from 'zod'
import { applyConfirmationSchema, applyOutcomeSchema, type ApplyConfirmation, type ApplyOutcome } from '../shared/applyViews.js'
import { entryConversationViewSchema, type EntryConversationView } from '../shared/conversationEntryViews.js'
import {
  actionFinishedEventSchema,
  actionStartedEventSchema,
  conversationErrorEventSchema,
  entryAppendedEventSchema,
  participantActivityEventSchema,
  roomActivitySnapshotSchema,
  type ConversationErrorEvent,
  type RoomActivitySnapshot,
} from '../shared/conversationEvents.js'
import type { DocumentSnapshot, PieceSurfaceId } from '../shared/surfaces.js'
import type { RoomEvent } from './entryProjection.js'
import { requestJson, type RequestResult } from './request.js'

function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function surfacePath(pieceId: string, surface: PieceSurfaceId): string {
  return `/pieces/${encodeURIComponent(pieceId)}/surfaces/${surface}`
}

export function createConversation(pieceId: string, surface: PieceSurfaceId, signal?: AbortSignal): Promise<RequestResult<{ id: string }>> {
  return requestJson(`${surfacePath(pieceId, surface)}/conversations`, z.object({ id: z.string() }), {
    method: 'POST',
    signal: signal ?? null,
  })
}

export function fetchConversation(
  pieceId: string,
  surface: PieceSurfaceId,
  conversationId: string,
  signal?: AbortSignal,
): Promise<RequestResult<EntryConversationView>> {
  return requestJson(`${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}`, entryConversationViewSchema, {
    signal: signal ?? null,
  })
}

export function deleteConversation(
  pieceId: string,
  surface: PieceSurfaceId,
  conversationId: string,
  signal?: AbortSignal,
): Promise<RequestResult<null>> {
  return requestJson(`${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}`, z.null(), {
    method: 'DELETE',
    signal: signal ?? null,
  })
}

const dispatchResultSchema = z.object({ conversationId: z.string(), actionId: z.string() })

export type DispatchOpening =
  | Readonly<{ message: string }>
  | Readonly<{ target: string; message: string }>
  | Readonly<{ respondingTo: string; clarification: string | undefined }>

export function dispatch(
  pieceId: string,
  surface: PieceSurfaceId,
  conversationId: string,
  opening: DispatchOpening,
  documents: DocumentSnapshot,
  signal?: AbortSignal,
): Promise<RequestResult<{ conversationId: string; actionId: string }>> {
  return requestJson(`${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}/dispatch`, dispatchResultSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...opening, documents }),
    signal: signal ?? null,
  })
}

export function applyRecommendation(
  pieceId: string,
  surface: PieceSurfaceId,
  conversationId: string,
  responseId: string,
  documents: DocumentSnapshot,
  constraint: string | undefined,
  signal?: AbortSignal,
): Promise<RequestResult<ApplyOutcome>> {
  return requestJson(`${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}/apply`, applyOutcomeSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ responseId, documents, constraint }),
    signal: signal ?? null,
  })
}

export function confirmApplication(
  pieceId: string,
  surface: PieceSurfaceId,
  conversationId: string,
  applicationId: string,
  signal?: AbortSignal,
): Promise<RequestResult<ApplyConfirmation>> {
  return requestJson(
    `${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}/apply/${encodeURIComponent(applicationId)}/confirm`,
    applyConfirmationSchema,
    { method: 'POST', signal: signal ?? null },
  )
}

export function abandonOperation(
  pieceId: string,
  surface: PieceSurfaceId,
  conversationId: string,
  actionId: string,
  signal?: AbortSignal,
): Promise<RequestResult<null>> {
  return requestJson(
    `${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}/actions/${encodeURIComponent(actionId)}/abandon`,
    z.null(),
    { method: 'POST', signal: signal ?? null },
  )
}

export const EMPTY_ROOM_ACTIVITY: RoomActivitySnapshot = { draft: null, storyContext: null, authorContext: null }

export function subscribeToRoom(
  pieceId: string,
  onEvent: (event: RoomEvent) => void,
  onMalformedFrame: (message: string) => void,
): Readonly<{ snapshot: Promise<RoomActivitySnapshot>; unsubscribe: () => void }> {
  const source = new EventSource(`/pieces/${encodeURIComponent(pieceId)}/events`)

  function listen<T>(name: string, schema: z.ZodType<T>, wrap: (data: T) => RoomEvent): void {
    source.addEventListener(name, (event) => {
      if (!(event instanceof MessageEvent)) return
      const frame: unknown = event.data
      const parsed = typeof frame === 'string' ? schema.safeParse(readJson(frame)) : { success: false as const }
      if (!parsed.success) {
        onMalformedFrame(`malformed "${name}" event from the studio`)
        return
      }
      onEvent(wrap(parsed.data))
    })
  }

  const snapshot = new Promise<RoomActivitySnapshot>((resolve) => {
    source.addEventListener(
      'activity.snapshot',
      (event) => {
        if (!(event instanceof MessageEvent)) {
          resolve(EMPTY_ROOM_ACTIVITY)
          return
        }
        const frame: unknown = event.data
        const parsed = typeof frame === 'string' ? roomActivitySnapshotSchema.safeParse(readJson(frame)) : { success: false as const }
        if (!parsed.success) {
          onMalformedFrame('malformed "activity.snapshot" event from the studio')
          resolve(EMPTY_ROOM_ACTIVITY)
          return
        }
        resolve(parsed.data)
      },
      { once: true },
    )
  })

  listen('action.started', actionStartedEventSchema, (data) => ({ type: 'action.started', data }))
  listen('participant.activity', participantActivityEventSchema, (data) => ({ type: 'participant.activity', data }))
  listen('entry.appended', entryAppendedEventSchema, (data) => ({ type: 'entry.appended', data }))
  listen('action.finished', actionFinishedEventSchema, (data) => ({ type: 'action.finished', data }))
  listen('error', conversationErrorEventSchema, (data: ConversationErrorEvent) => ({ type: 'error', data }))

  return { snapshot, unsubscribe: () => source.close() }
}
