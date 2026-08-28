import type { SSEStreamingApi } from 'hono/streaming'
import { describe, expect, it } from 'vitest'
import { sseStream } from '../../src/server/sse.js'

function fakeStream(writeSSE: (message: unknown) => Promise<void>): SSEStreamingApi {
  return { writeSSE } as unknown as SSEStreamingApi
}

describe('sseStream', () => {
  it('writes every frame in order and drain resolves once they have all landed', async () => {
    const written: unknown[] = []
    const stream = fakeStream((message) => {
      written.push(message)
      return Promise.resolve()
    })
    const events = sseStream(stream)

    events.write('entry.appended', { id: 'e1' })
    events.write('action.finished', { id: 'e2' })
    await events.drain()

    expect(written).toEqual([
      { event: 'entry.appended', data: JSON.stringify({ id: 'e1' }) },
      { event: 'action.finished', data: JSON.stringify({ id: 'e2' }) },
    ])
  })

  it('preserves the first rejection, refuses every write behind it, and reports the failure to drain instead of the frames it never sent', async () => {
    const written: unknown[] = []
    const failure = new Error('the connection dropped mid-frame')
    const stream = fakeStream((message) => {
      written.push(message)
      return Promise.reject(failure)
    })
    const events = sseStream(stream)

    events.write('entry.appended', { id: 'e1' })
    events.write('action.finished', { id: 'e2' })
    events.write('error', { id: 'e3' })

    await expect(events.drain()).rejects.toBe(failure)
    expect(written).toEqual([{ event: 'entry.appended', data: JSON.stringify({ id: 'e1' }) }])
  })
})
