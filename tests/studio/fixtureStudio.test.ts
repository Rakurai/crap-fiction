import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const STUDIO_VARIABLES = ['STUDIO_DATA_ROOT', 'STUDIO_PORT', 'STUDIO_MODEL_RUNTIME_URL', 'STUDIO_LOG_LEVEL'] as const

describe('the fixture studio', () => {
  let dataRoot: string
  let app: Hono
  let restoreEnv: Readonly<Record<string, string | undefined>>

  beforeAll(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-fixture-entry-'))
    restoreEnv = Object.fromEntries(STUDIO_VARIABLES.map((name) => [name, process.env[name]]))
    // Importing the entry stands the studio up, so the environment it reads goes in place first.
    process.env.STUDIO_DATA_ROOT = dataRoot
    process.env.STUDIO_PORT = '5274'
    process.env.STUDIO_MODEL_RUNTIME_URL = 'ws://127.0.0.1:5275'
    process.env.STUDIO_LOG_LEVEL = 'silent'
    app = (await import('../support/fixtureStudio.js')).default
  })

  afterAll(() => {
    rmSync(dataRoot, { recursive: true, force: true })
    // The environment belongs to the process, not to this file: leave it as it was found.
    for (const name of STUDIO_VARIABLES) {
      const previous = restoreEnv[name]
      if (previous === undefined) delete process.env[name]
      else process.env[name] = previous
    }
  })

  it('starts against the shipped mode, roles and charter, and reports the fixture implementation as the runtime it reaches', async () => {
    const res = await app.request('/models')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { reachable: true, models: ['fixture'] } })
  })

  it('opens a dispatch over the same routes the author\'s studio serves, with every call site assigned', async () => {
    await app.request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: 'my-writing' }),
    })
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const res = await app.request('/pieces/cups/conversations/c1/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'does the opening earn its length', draft: 'The cups sat where she left them.' }),
    })

    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ conversationId: 'c1' })
  })

})
