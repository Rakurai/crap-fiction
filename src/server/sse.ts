import type { SSEStreamingApi } from 'hono/streaming'

export const SSE_EVENT_NAMES = [
  'action.started',
  'participant.activity',
  'entry.appended',
  'action.finished',
  'error',
] as const

export type SseEventName = (typeof SSE_EVENT_NAMES)[number]

export function sseStream(stream: SSEStreamingApi): {
  write: (event: SseEventName, data: unknown) => void
  drain: () => Promise<void>
} {
  // The room emits synchronously and writing a frame is asynchronous: the chain
  // stops two frames interleaving into one a client cannot parse.
  let written: Promise<void> = Promise.resolve()
  return {
    write: (event, data) => {
      written = written.then(() => stream.writeSSE({ event, data: JSON.stringify(data) }))
    },
    drain: () => written.catch(() => undefined),
  }
}
