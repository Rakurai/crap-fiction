import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ModelAccess } from '../../../src/server/model/modelAccess.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../../support/modelAdapter.js'
import { buildTestApp } from '../../support/harness.js'
import { buildTestRoom } from '../../support/room.js'

const CONFORMING_RESULT = { outcome: 'value' as const, value: { outcome: 'commentary' as const, claim: 'a reading' } }

describe('the room over HTTP', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function buildApp(delayMs?: number) {
    // Conforms to both the eligible and the owed response schema, so one
    // fixture behaviour serves every call site in these routes-level tests.
    const behavior: FixtureBehavior = delayMs === undefined ? { result: CONFORMING_RESULT } : { result: CONFORMING_RESULT, delayMs }
    const modelAccess = new ModelAccess(FixtureModelAdapter.uniform(behavior, { reachable: true, models: [] }), (site) => site)
    const room = buildTestRoom({ modelAccess })
    return buildTestApp(dataRoot, { room })
  }

  async function withPiece(delayMs?: number) {
    const { app, workspace } = buildApp(delayMs)
    await workspace.set('my-writing')
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })
    return app
  }

  async function waitForSettled(app: ReturnType<typeof buildApp>['app'], pieceId: string): Promise<void> {
    for (let i = 0; i < 100; i++) {
      const res = await app.request(`/pieces/${pieceId}`)
      const body = await res.json()
      if (body.data.roundInFlight === null) return
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    throw new Error('round never settled')
  }

  it('mints a conversation id that writes nothing until the first round opens', async () => {
    const app = await withPiece()

    const res = await app.request('/pieces/cups/conversations', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.data.id).toBe('string')

    const getRes = await app.request(`/pieces/cups/conversations/${body.data.id}`)
    expect(getRes.status).toBe(404)
    expect(await getRes.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })
  })

  it('opens a round over HTTP and reports it no longer in flight once it settles', async () => {
    const app = await withPiece()

    const roundRes = await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '@shape does the opening earn its length', draft: 'The cups sat where she left them.' }),
    })
    expect(roundRes.status).toBe(200)
    const { conversationId, roundId } = (await roundRes.json()).data
    expect(typeof conversationId).toBe('string')
    expect(typeof roundId).toBe('string')

    await waitForSettled(app, 'cups')

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.currentConversationId).toBe(conversationId)
    expect(pieceBody.data.roundInFlight).toBeNull()
  })

  it('refuses a second author-initiated round while one is in flight, with ROOM_BUSY', async () => {
    const app = await withPiece(50)

    const first = await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'a message', draft: 'text' }),
    })
    expect(first.status).toBe(200)

    const second = await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'another message', draft: 'text' }),
    })
    expect(second.status).toBe(409)
    expect(await second.json()).toMatchObject({ success: false, error: { code: 'ROOM_BUSY' } })

    await waitForSettled(app, 'cups')
  })

  it('reports the round in flight on the piece before it settles, so a reload mid-round knows what it is watching', async () => {
    const app = await withPiece(50)

    await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'a message', draft: 'text' }),
    })

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.roundInFlight).not.toBeNull()
    expect(pieceBody.data.roundInFlight.participants).toContain('shape')

    await waitForSettled(app, 'cups')
  })
})
