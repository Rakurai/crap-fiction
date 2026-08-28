import { z } from 'zod'
import {
  applyConfirmationSchema,
  applyOutcomeSchema,
  pendingApplySchema,
  type ApplyConfirmation,
  type ApplyOutcome,
  type PendingApply,
} from '../shared/applyViews.js'
import { entryConversationViewSchema, type EntryConversationView } from '../shared/conversationEntryViews.js'
import {
  roomActivitySnapshotSchema,
  roomEventSchema,
  type RoomActivitySnapshot,
  type RoomEvent,
  type RoomEventName,
} from '../shared/conversationEvents.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import { requestJson, type RequestResult } from './request.js'

function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function surfacePath(pieceId: string, surface: SurfaceId): string {
  return `/pieces/${encodeURIComponent(pieceId)}/surfaces/${surface}`
}

export function createConversation(pieceId: string, surface: SurfaceId, signal?: AbortSignal): Promise<RequestResult<{ id: string }>> {
  return requestJson(`${surfacePath(pieceId, surface)}/conversations`, z.object({ id: z.string() }), {
    method: 'POST',
    signal: signal ?? null,
  })
}

export function fetchConversation(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string,
  signal?: AbortSignal,
): Promise<RequestResult<EntryConversationView>> {
  return requestJson(`${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}`, entryConversationViewSchema, {
    signal: signal ?? null,
  })
}

export function deleteConversation(
  pieceId: string,
  surface: SurfaceId,
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
  surface: SurfaceId,
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
  surface: SurfaceId,
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
  surface: SurfaceId,
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

export function retrievePendingApply(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string,
  applicationId: string,
  signal?: AbortSignal,
): Promise<RequestResult<PendingApply>> {
  return requestJson(
    `${surfacePath(pieceId, surface)}/conversations/${encodeURIComponent(conversationId)}/apply/${encodeURIComponent(applicationId)}`,
    pendingApplySchema,
    { signal: signal ?? null },
  )
}

export function abandonOperation(
  pieceId: string,
  surface: SurfaceId,
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

const ACTIVITY_SNAPSHOT: RoomEventName = 'activity.snapshot'

export const EMPTY_ROOM_ACTIVITY: RoomActivitySnapshot = { draft: null, storyContext: null, authorContext: null }

export function subscribeToRoom(
  pieceId: string,
  onEvent: (event: RoomEvent) => void,
  onMalformedFrame: (message: string) => void,
): Readonly<{ snapshot: Promise<RoomActivitySnapshot>; unsubscribe: () => void }> {
  const source = new EventSource(`/pieces/${encodeURIComponent(pieceId)}/events`)

  function listen(name: RoomEventName): void {
    source.addEventListener(name, (event) => {
      if (!(event instanceof MessageEvent)) return
      const frame: unknown = event.data
      const parsed = typeof frame === 'string' ? roomEventSchema.safeParse({ type: name, data: readJson(frame) }) : { success: false as const }
      if (!parsed.success) {
        onMalformedFrame(`malformed "${name}" event from the studio`)
        return
      }
      onEvent(parsed.data)
    })
  }

  const snapshot = new Promise<RoomActivitySnapshot>((resolve, reject) => {
    source.addEventListener(
      ACTIVITY_SNAPSHOT,
      (event) => {
        if (!(event instanceof MessageEvent)) {
          reject(new Error('the room’s activity arrived as something this client cannot read'))
          return
        }
        const frame: unknown = event.data
        const parsed = typeof frame === 'string' ? roomActivitySnapshotSchema.safeParse(readJson(frame)) : { success: false as const }
        if (!parsed.success) {
          const message = `malformed "${ACTIVITY_SNAPSHOT}" event from the studio`
          onMalformedFrame(message)
          reject(new Error(message))
          return
        }
        resolve(parsed.data)
      },
      { once: true },
    )
    // An `EventSource` reports a dropped connection it is about to retry the same way it reports one
    // it has abandoned; only the closed state is terminal, and a retry that succeeds still delivers
    // the snapshot this is waiting for.
    source.addEventListener('error', () => {
      if (source.readyState === source.CLOSED) {
        reject(new Error('the room’s activity could not be learned — the connection to the studio failed'))
      }
    })
  })

  for (const frame of roomEventSchema.options) {
    for (const name of frame.shape.type.options) listen(name)
  }

  return { snapshot, unsubscribe: () => source.close() }
}
