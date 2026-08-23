import { z } from 'zod'
import { conversationSchema, type Conversation } from '../shared/conversationViews.js'
import {
  participantSettledEventSchema,
  participantStateEventSchema,
  roomErrorEventSchema,
  roundClosedEventSchema,
  roundOpenedEventSchema,
  type RoomErrorEvent,
} from '../shared/roundEvents.js'
import { RequestFailure, requestJson } from './request.js'
import type { RoundEvent } from './roundProjection.js'

export type RoomEvent = RoundEvent | Readonly<{ type: 'error'; data: RoomErrorEvent }>

export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly message: string }

export async function createConversation(pieceId: string, signal?: AbortSignal): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const { id } = await requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations`, z.object({ id: z.string() }), {
      method: 'POST',
      signal: signal ?? null,
    })
    return { ok: true, id }
  } catch (err) {
    if (err instanceof RequestFailure) return { ok: false, message: err.message }
    throw err
  }
}

export async function fetchConversation(pieceId: string, conversationId: string, signal?: AbortSignal): Promise<Conversation> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations/${encodeURIComponent(conversationId)}`, conversationSchema, {
    signal: signal ?? null,
  })
}

const startRoundResultSchema = z.object({ conversationId: z.string(), roundId: z.string() })

/**
 * SPEC "Write semantics": the current text travels in this request either
 * way — the caller is expected to have flushed the pending draft write
 * without waiting on it before calling this, and to pass the same text here.
 */
export async function startRound(pieceId: string, conversationId: string, message: string, draft: string, signal?: AbortSignal): Promise<ActionResult> {
  try {
    await requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations/${encodeURIComponent(conversationId)}/rounds`, startRoundResultSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, draft }),
      signal: signal ?? null,
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof RequestFailure) return { ok: false, message: err.message }
    throw err
  }
}

export async function abandonRound(pieceId: string, signal?: AbortSignal): Promise<void> {
  await requestJson(`/pieces/${encodeURIComponent(pieceId)}/abandon`, z.null(), { method: 'POST', signal: signal ?? null })
}

/**
 * SPEC "Transport": server-sent events for round activity, one stream for
 * the open piece. Each frame is validated against its own event's schema
 * before anything downstream trusts it — the same seam discipline every
 * other client adapter applies to a JSON response.
 */
export function subscribeToRoom(pieceId: string, onEvent: (event: RoomEvent) => void): () => void {
  const source = new EventSource(`/pieces/${encodeURIComponent(pieceId)}/events`)

  function listen<T>(name: string, schema: z.ZodType<T>, wrap: (data: T) => RoomEvent): void {
    source.addEventListener(name, (event) => {
      if (!(event instanceof MessageEvent)) return
      const parsed = schema.safeParse(JSON.parse(event.data as string))
      if (parsed.success) onEvent(wrap(parsed.data))
    })
  }

  listen('round.opened', roundOpenedEventSchema, (data) => ({ type: 'round.opened', data }))
  listen('participant.state', participantStateEventSchema, (data) => ({ type: 'participant.state', data }))
  listen('participant.settled', participantSettledEventSchema, (data) => ({ type: 'participant.settled', data }))
  listen('round.closed', roundClosedEventSchema, (data) => ({ type: 'round.closed', data }))
  listen('error', roomErrorEventSchema, (data) => ({ type: 'error', data }))

  return () => source.close()
}
