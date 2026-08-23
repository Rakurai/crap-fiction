import devServer, { defaultOptions } from '@hono/vite-dev-server'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SSE_EVENT_NAMES } from '../../src/server/sse.js'

/**
 * Proves SPEC's second early proof: a round's SSE frames must reach a
 * client through the dev server, not buffered until the connection
 * closes. This runs against the same @hono/vite-dev-server transport the
 * real dev server uses, exercising the closed event set against a fixture
 * route rather than the room, which does not exist yet.
 */
describe('SSE transport through the Vite dev server', () => {
  let server: ViteDevServer
  let baseUrl: string

  beforeEach(async () => {
    server = await createServer({
      configFile: false,
      root: process.cwd(),
      logLevel: 'silent',
      plugins: [
        devServer({
          entry: 'tests/fixtures/sseProofApp.ts',
          exclude: [...defaultOptions.exclude, /^\/$/],
        }),
      ],
      server: { port: 0, host: '127.0.0.1' },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (address === null || typeof address === 'string' || address === undefined) {
      throw new Error('dev server did not bind to a TCP port')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await server.close()
  })

  it('delivers every event in the closed set, incrementally rather than in one final chunk', async () => {
    const res = await fetch(`${baseUrl}/sse-proof`)
    expect(res.status).toBe(200)
    if (!res.body) {
      throw new Error('response carried no body')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const arrivals: Array<{ text: string; at: number }> = []
    const start = performance.now()

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      arrivals.push({ text: decoder.decode(value), at: performance.now() - start })
    }

    const names = arrivals
      .map((frame) => /^event: (.+)$/m.exec(frame.text)?.[1])
      .filter((name): name is string => name !== undefined)

    expect(names).toEqual([...SSE_EVENT_NAMES])

    // Streamed, not buffered: the frames the fixture paced 50ms apart must
    // arrive as separate reads spread over comparable wall-clock time, not
    // as one read after the stream already closed.
    expect(arrivals.length).toBeGreaterThanOrEqual(SSE_EVENT_NAMES.length)
    const firstArrival = arrivals[0]?.at ?? 0
    const lastArrival = arrivals.at(-1)?.at ?? 0
    expect(lastArrival - firstArrival).toBeGreaterThan(100)
  })
})
