import { z } from 'zod'
import { applyOutcomeSchema, type ApplyOutcome } from '../shared/applyViews.js'
import { captureApproveOutcomeSchema, type CaptureApproveOutcome, type CaptureProposal } from '../shared/captureProposal.js'
import { captureOutcomeSchema, type CaptureOutcome } from '../shared/captureViews.js'
import { conversationViewSchema, type ConversationView } from '../shared/conversationViews.js'
import {
  participantSettledEventSchema,
  participantStateEventSchema,
  roomErrorEventSchema,
  roundClosedEventSchema,
  roundOpenedEventSchema,
  type RoomErrorEvent,
} from '../shared/roundEvents.js'
import { requestJson, type RequestResult } from './request.js'
import type { RoundEvent } from './roundProjection.js'

export type RoomEvent = RoundEvent | Readonly<{ type: 'error'; data: RoomErrorEvent }>

/** A frame that is not JSON at all is refused the same way one that is JSON of the wrong shape is. */
function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function createConversation(pieceId: string, signal?: AbortSignal): Promise<RequestResult<{ id: string }>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations`, z.object({ id: z.string() }), {
    method: 'POST',
    signal: signal ?? null,
  })
}

export function fetchConversation(
  pieceId: string,
  conversationId: string,
  signal?: AbortSignal,
): Promise<RequestResult<ConversationView>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations/${encodeURIComponent(conversationId)}`, conversationViewSchema, {
    signal: signal ?? null,
  })
}

/**
 * #17 "Conversations": deletes the conversation and the change files its
 * applications name — one call, the studio's own answer to "nothing left on
 * disk for the author to prune".
 */
export function deleteConversation(pieceId: string, conversationId: string, signal?: AbortSignal): Promise<RequestResult<null>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations/${encodeURIComponent(conversationId)}`, z.null(), {
    method: 'DELETE',
    signal: signal ?? null,
  })
}

const startRoundResultSchema = z.object({ conversationId: z.string(), roundId: z.string() })

/**
 * SPEC "Transport": the author's message, or a round opened from a particular
 * response — a target and the reply sent to it, or the response being asked
 * for a concrete change and any clarification.
 */
export type RoundOpening =
  | Readonly<{ message: string }>
  | Readonly<{ target: string; message: string }>
  | Readonly<{ respondingTo: Readonly<{ roundId: string; participantId: string }>; clarification: string | undefined }>

/**
 * SPEC "Write semantics": the current text travels in this request either
 * way — the caller is expected to have flushed the pending draft write
 * without waiting on it before calling this, and to pass the same text here.
 */
export function startRound(
  pieceId: string,
  conversationId: string,
  opening: RoundOpening,
  draft: string,
  signal?: AbortSignal,
): Promise<RequestResult<{ conversationId: string; roundId: string }>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations/${encodeURIComponent(conversationId)}/rounds`, startRoundResultSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...opening, draft }),
    signal: signal ?? null,
  })
}

/**
 * CONTEXT "Apply"/SPEC "Applying a recommendation": the response applied,
 * identified by the round and participant it came from, and any constraint
 * the author supplied verbatim. `draft` travels the same way a round's does —
 * the caller is expected to have flushed the pending draft write without
 * waiting on it and to pass the same text here — because the room never
 * reads the manuscript from disk to serve a call.
 */
export function applyRecommendation(
  pieceId: string,
  conversationId: string,
  roundId: string,
  participantId: string,
  draft: string,
  constraint: string | undefined,
  signal?: AbortSignal,
): Promise<RequestResult<ApplyOutcome>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations/${encodeURIComponent(conversationId)}/apply`, applyOutcomeSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roundId, participantId, draft, constraint }),
    signal: signal ?? null,
  })
}

/**
 * CONTEXT "Capture context"/SPEC "Context capture": the draft and the
 * conversation the analysis reads, named by the client because the room
 * never reads the manuscript from disk to serve a call — the same reason
 * `startRound` and `applyRecommendation` carry `draft` rather than leaving
 * the room to find it.
 */
export function captureContext(
  pieceId: string,
  conversationId: string,
  draft: string,
  signal?: AbortSignal,
): Promise<RequestResult<CaptureOutcome>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/capture`, captureOutcomeSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId, draft }),
    signal: signal ?? null,
  })
}

/**
 * SPEC "Context capture": the review holds nothing server-side between the
 * two requests, so the approved proposals travel here whole, exactly as the
 * capture call returned them.
 */
export function approveCapture(
  pieceId: string,
  approved: readonly CaptureProposal[],
  signal?: AbortSignal,
): Promise<RequestResult<CaptureApproveOutcome>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/capture/approve`, captureApproveOutcomeSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ approved }),
    signal: signal ?? null,
  })
}

/**
 * SPEC "Room": whatever operation is in flight for the piece, stopped —
 * the room is the authority on which one that is, so this names only the
 * piece and carries nothing about a round or a conversation.
 */
export function abandonOperation(pieceId: string, signal?: AbortSignal): Promise<RequestResult<null>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/abandon`, z.null(), {
    method: 'POST',
    signal: signal ?? null,
  })
}

/**
 * SPEC "Transport": server-sent events for round activity, one stream for
 * the open piece. Each frame is validated against its own event's schema
 * before anything downstream trusts it — the same seam discipline every
 * other client adapter applies to a JSON response.
 */
export function subscribeToRoom(
  pieceId: string,
  onEvent: (event: RoomEvent) => void,
  onMalformedFrame: (message: string) => void,
): () => void {
  const source = new EventSource(`/pieces/${encodeURIComponent(pieceId)}/events`)

  function listen<T>(name: string, schema: z.ZodType<T>, wrap: (data: T) => RoomEvent): void {
    source.addEventListener(name, (event) => {
      if (!(event instanceof MessageEvent)) return
      // A frame's payload is a string or the stream is not the one this adapter
      // subscribed to, so the shape is checked rather than asserted. A frame the
      // schema refuses is reported and not applied: dropping it silently would
      // leave the author watching a round that stopped moving with nothing said.
      const frame: unknown = event.data
      const parsed = typeof frame === 'string' ? schema.safeParse(readJson(frame)) : { success: false as const }
      if (!parsed.success) {
        onMalformedFrame(`malformed "${name}" event from the studio`)
        return
      }
      onEvent(wrap(parsed.data))
    })
  }

  listen('round.opened', roundOpenedEventSchema, (data) => ({ type: 'round.opened', data }))
  listen('participant.state', participantStateEventSchema, (data) => ({ type: 'participant.state', data }))
  listen('participant.settled', participantSettledEventSchema, (data) => ({ type: 'participant.settled', data }))
  listen('round.closed', roundClosedEventSchema, (data) => ({ type: 'round.closed', data }))
  listen('error', roomErrorEventSchema, (data) => ({ type: 'error', data }))

  return () => source.close()
}
