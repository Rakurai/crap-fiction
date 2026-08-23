import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * #21: the studio can be started answering from the fixture model implementation.
 * Here that studio is stood up and asked, over the routes the author's own studio
 * serves, whether it answers. The other half of #21 — that the deployment the
 * author runs cannot reach the way this one is asked for — is a fact about the
 * repo's import graph rather than about a running studio, and is held at
 * `tests/repo/importGraph.test.ts`.
 */
describe('the fixture studio', () => {
  let dataRoot: string
  let app: Hono

  beforeAll(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-fixture-entry-'))
    // The entry stands the studio up as it is imported, which is what makes it
    // an entry rather than a factory, so the environment it reads is in place
    // first. These are the four STUDIO_* variables and no fifth: the fixture is
    // asked for by importing this module, never by a setting.
    process.env.STUDIO_DATA_ROOT = dataRoot
    process.env.STUDIO_PORT = '5274'
    process.env.STUDIO_MODEL_RUNTIME_URL = 'ws://127.0.0.1:5275'
    process.env.STUDIO_LOG_LEVEL = 'silent'
    app = (await import('../support/fixtureStudio.js')).default
  })

  afterAll(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('starts against the shipped mode, roles and charter, and reports the fixture implementation as the runtime it reaches', async () => {
    const res = await app.request('/models')

    // The real entry would report the LM Studio runtime at STUDIO_MODEL_RUNTIME_URL,
    // which nothing in this test is listening on: a reachable runtime named
    // `fixture` is the fixture implementation answering and could be nothing else.
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { reachable: true, models: ['fixture'] } })
  })

  it('opens a round over the same routes the author\'s studio serves, with every call site assigned', async () => {
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

    const res = await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'does the opening earn its length', draft: 'The cups sat where she left them.' }),
    })

    // A round opening at all is the whole of what this entry adds: no site is
    // unassigned, so no call fails for want of a model. What the round then does
    // is the room's own, proven at `room.test.ts`, and what the author sees of it
    // is the browser journey's.
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ conversationId: 'c1' })
  })

})
