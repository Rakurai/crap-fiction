import devServer, { defaultOptions } from '@hono/vite-dev-server'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const STUDIO_VARIABLES = ['STUDIO_DATA_ROOT', 'STUDIO_PORT', 'STUDIO_MODEL_RUNTIME_URL', 'STUDIO_LOG_LEVEL'] as const

describe('a dispatch\'s events through the dev server', () => {
  let server: ViteDevServer
  let baseUrl: string
  let dataRoot: string
  let restoreEnv: Readonly<Record<string, string | undefined>>

  beforeEach(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-streaming-'))
    restoreEnv = Object.fromEntries(STUDIO_VARIABLES.map((name) => [name, process.env[name]]))
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
    // The environment belongs to the process, not to this file: leave it as it was found.
    for (const name of STUDIO_VARIABLES) {
      const previous = restoreEnv[name]
      if (previous === undefined) delete process.env[name]
      else process.env[name] = previous
    }
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

  it('delivers a dispatch\'s frames while the stream is still open, rather than at the end of it', async () => {
    await fetch(`${baseUrl}/workspace`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: 'my-writing' }),
    })
    const piece = (await post('/pieces', { title: 'Cups', mode: 'flash' })) as { id: string }
    const conversation = (await post(`/pieces/${piece.id}/conversations`)) as { id: string }

    const stream = await fetch(`${baseUrl}/pieces/${piece.id}/events`)
    expect(stream.status).toBe(200)
    if (stream.body === null) throw new Error('the events response carried no body')
    const reader = stream.body.getReader()

    await post(`/pieces/${piece.id}/conversations/${conversation.id}/dispatch`, {
      message: 'What do you make of this?',
      draft: 'The cups sat where she left them.',
    })

    const decoder = new TextDecoder()
    let received = ''
    let names: readonly string[] = []
    while (!names.includes('action.finished')) {
      const { done, value } = await reader.read()
      if (done) throw new Error(`the stream ended before the action finished, having delivered ${names.join(', ')}`)
      received += decoder.decode(value, { stream: true })
      names = [...received.matchAll(/^event: (.+)$/gm)].map((match) => match[1] ?? '')
    }
    await reader.cancel()

    expect(names[0]).toBe('action.started')
    expect(names).toContain('entry.appended')
    expect(names.at(-1)).toBe('action.finished')
  }, 30_000)
})
