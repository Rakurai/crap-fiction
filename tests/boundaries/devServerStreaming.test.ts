import devServer, { defaultOptions } from '@hono/vite-dev-server'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * SPEC "Deployment": streaming through the dev server is proven early, because
 * it is the one part of the studio's arrangement the product depends on and does
 * not control. A server that buffered a round's events until the connection
 * closed would leave the author watching a blank room and then a finished one,
 * and no test of the room or its route could see it — the buffering happens
 * below both.
 *
 * So this drives the studio's own application through the same
 * `@hono/vite-dev-server` transport `make run` uses, and watches a real round on
 * the real events route. The round needs no model runtime: no call site is
 * assigned one, so every participant fails as unconfigured without the runtime
 * being contacted, and the events that frame a round are emitted either way.
 */
describe('a round\'s events through the dev server', () => {
  let server: ViteDevServer
  let baseUrl: string
  let dataRoot: string

  beforeEach(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-streaming-'))
    process.env.STUDIO_DATA_ROOT = dataRoot
    process.env.STUDIO_PORT = '4000'
    process.env.STUDIO_MODEL_RUNTIME_URL = 'ws://127.0.0.1:1234'
    process.env.STUDIO_LOG_LEVEL = 'silent'

    server = await createServer({
      configFile: false,
      root: process.cwd(),
      logLevel: 'silent',
      plugins: [devServer({ entry: 'src/server/index.ts', exclude: [...defaultOptions.exclude, /^\/$/] })],
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
    rmSync(dataRoot, { recursive: true, force: true })
  })

  async function post(pathname: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
    })
    const parsed = (await res.json()) as { success: boolean; data?: unknown; error?: { message: string } }
    if (!parsed.success) throw new Error(`${pathname} failed: ${parsed.error?.message ?? 'unknown'}`)
    return parsed.data
  }

  it('delivers a round\'s frames while the stream is still open, rather than at the end of it', async () => {
    await fetch(`${baseUrl}/workspace`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: 'my-writing' }),
    })
    const piece = (await post('/pieces', { title: 'Cups' })) as { id: string }
    const conversation = (await post(`/pieces/${piece.id}/conversations`)) as { id: string }

    // Subscribed before the round opens, so the frame that opens it is one this
    // reader has to be handed rather than one it could find in a closed body.
    const stream = await fetch(`${baseUrl}/pieces/${piece.id}/events`)
    expect(stream.status).toBe(200)
    if (stream.body === null) throw new Error('the events response carried no body')
    const reader = stream.body.getReader()

    await post(`/pieces/${piece.id}/conversations/${conversation.id}/rounds`, {
      message: 'What do you make of this?',
      draft: 'The cups sat where she left them.',
    })

    // The events route closes only when the client goes away, so every frame
    // below arrives while the stream is open by construction: a transport that
    // buffered until close would hand this reader nothing and the test would
    // fail by timing out, with no wall-clock margin to tune.
    const decoder = new TextDecoder()
    let received = ''
    let names: readonly string[] = []
    while (!names.includes('round.closed')) {
      const { done, value } = await reader.read()
      if (done) throw new Error(`the stream ended before the round closed, having delivered ${names.join(', ')}`)
      received += decoder.decode(value, { stream: true })
      names = [...received.matchAll(/^event: (.+)$/gm)].map((match) => match[1] ?? '')
    }
    await reader.cancel()

    expect(names[0]).toBe('round.opened')
    expect(names).toContain('participant.settled')
    expect(names.at(-1)).toBe('round.closed')
  }, 30_000)
})
