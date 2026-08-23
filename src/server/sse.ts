import type { SSEStreamingApi } from 'hono/streaming'

/**
 * SPEC "Transport": the event set a round's activity may emit is closed,
 * and every event corresponds to a call that produced something or to a
 * frame around one. What each event carries is the room's to say — this
 * names the set and writes a frame, and nothing else decides either.
 */
export const SSE_EVENT_NAMES = [
  'round.opened',
  'participant.state',
  'participant.settled',
  'round.closed',
  'error',
] as const

export type SseEventName = (typeof SSE_EVENT_NAMES)[number]

export async function writeSseEvent(
  stream: SSEStreamingApi,
  event: SseEventName,
  data: unknown,
): Promise<void> {
  await stream.writeSSE({ event, data: JSON.stringify(data) })
}
