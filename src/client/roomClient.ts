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

export function deleteConversation(pieceId: string, conversationId: string, signal?: AbortSignal): Promise<RequestResult<null>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/conversations/${encodeURIComponent(conversationId)}`, z.null(), {
    method: 'DELETE',
    signal: signal ?? null,
  })
}

const startRoundResultSchema = z.object({ conversationId: z.string(), roundId: z.string() })

export type RoundOpening =
  | Readonly<{ message: string }>
  | Readonly<{ target: string; message: string }>
  | Readonly<{ respondingTo: Readonly<{ roundId: string; participantId: string }>; clarification: string | undefined }>

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

export function abandonOperation(pieceId: string, signal?: AbortSignal): Promise<RequestResult<null>> {
  return requestJson(`/pieces/${encodeURIComponent(pieceId)}/abandon`, z.null(), {
    method: 'POST',
    signal: signal ?? null,
  })
}

export function subscribeToRoom(
  pieceId: string,
  onEvent: (event: RoomEvent) => void,
  onMalformedFrame: (message: string) => void,
): () => void {
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

  listen('round.opened', roundOpenedEventSchema, (data) => ({ type: 'round.opened', data }))
  listen('participant.state', participantStateEventSchema, (data) => ({ type: 'participant.state', data }))
  listen('participant.settled', participantSettledEventSchema, (data) => ({ type: 'participant.settled', data }))
  listen('round.closed', roundClosedEventSchema, (data) => ({ type: 'round.closed', data }))
  listen('error', roomErrorEventSchema, (data) => ({ type: 'error', data }))

  return () => source.close()
}
