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

/**
 * One stream, written one frame at a time. The room emits synchronously while
 * writing a frame is asynchronous, so without something holding the order two
 * frames can interleave into one a client cannot parse. That ordering is this
 * module's concern rather than the route's: a route that kept the chain itself
 * would be the second place that knows how a frame reaches the wire.
 *
 * `write` returns nothing because the emitter has nothing to do with the
 * outcome; `drain` is how the route waits for what it has accepted to be
 * written before the stream closes, so the chain is never left floating.
 */
export function sseStream(stream: SSEStreamingApi): {
  write: (event: SseEventName, data: unknown) => void
  drain: () => Promise<void>
} {
  let written: Promise<void> = Promise.resolve()
  return {
    write: (event, data) => {
      written = written.then(() => stream.writeSSE({ event, data: JSON.stringify(data) }))
    },
    // A stream the client has already gone from rejects its remaining writes,
    // which is the ordinary end of every subscription rather than a failure the
    // route could act on.
    drain: () => written.catch(() => undefined),
  }
}
