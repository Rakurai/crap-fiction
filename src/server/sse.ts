import type { SSEStreamingApi } from 'hono/streaming'

export const SSE_EVENT_NAMES = [
  'activity.snapshot',
  'action.started',
  'apply.pending',
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
  let failure: Error | undefined = undefined

  return {
    write: (event, data) => {
      written = written.then(() => {
        if (failure !== undefined) return
        return stream.writeSSE({ event, data: JSON.stringify(data) }).catch((err: unknown) => {
          failure = err instanceof Error ? err : new Error(String(err))
        })
      })
    },
    drain: () =>
      written.then(() => {
        if (failure !== undefined) throw failure
      }),
  }
}
