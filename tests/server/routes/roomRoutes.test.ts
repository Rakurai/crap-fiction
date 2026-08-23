import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Room } from '../../../src/server/room/room.js'
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

  /**
   * The app under test, and the room it was built with. The room is held so a
   * test can wait on a round it started over HTTP: the response comes back as
   * soon as the round opens, and re-requesting the piece until it reports nothing
   * in flight would be a polling loop asserting nothing.
   */
  async function withPiece(delayMs?: number): Promise<{ app: Hono; room: Room }> {
    // Conforms to both the eligible and the owed response schema, so one
    // fixture behaviour serves every call site in these routes-level tests.
    const behavior: FixtureBehavior = delayMs === undefined ? { result: CONFORMING_RESULT } : { result: CONFORMING_RESULT, delayMs }
    const modelAccess = FixtureModelAdapter.uniform(behavior, { reachable: true, models: [] })
    const room = buildTestRoom(dataRoot, { modelAccess })
    const { app, workspace } = buildTestApp(dataRoot, { room })

    await workspace.set('my-writing')
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })
    return { app, room }
  }

  function settlementOf(room: Room, pieceId: string): Promise<void> {
    const settlement = room.settlement(pieceId)
    if (settlement === undefined) throw new Error(`no round in flight for "${pieceId}"`)
    return settlement
  }

  it('mints a conversation id that writes nothing until the first round opens', async () => {
    const { app } = await withPiece()

    const res = await app.request('/pieces/cups/conversations', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.data.id).toBe('string')

    const getRes = await app.request(`/pieces/cups/conversations/${body.data.id}`)
    expect(getRes.status).toBe(404)
    expect(await getRes.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })
  })

  it('opens a round over HTTP and reports it no longer in flight once it settles', async () => {
    const { app, room } = await withPiece()

    const roundRes = await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '@shape does the opening earn its length', draft: 'The cups sat where she left them.' }),
    })
    expect(roundRes.status).toBe(200)
    const { conversationId, roundId } = (await roundRes.json()).data
    expect(typeof conversationId).toBe('string')
    expect(typeof roundId).toBe('string')

    await settlementOf(room, 'cups')

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.currentConversationId).toBe(conversationId)
    expect(pieceBody.data.roundInFlight).toBeNull()
  })

  it('refuses a second author-initiated round while one is in flight, with ROOM_BUSY', async () => {
    const { app, room } = await withPiece(50)

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

    await settlementOf(room, 'cups')
  })

  /**
   * Abandonment is idempotent and the room, not the store, is the authority on what
   * is in flight — so abandoning nothing is a legitimate 200. Before a workspace
   * exists it is not: this route answers the same way every other `/pieces/...`
   * route does rather than reporting a request carried out in a place the author
   * has not chosen yet.
   */
  it('refuses to abandon before a workspace is set, and abandons nothing afterwards without complaint', async () => {
    const bare = buildTestApp(dataRoot).app

    const refused = await bare.request('/pieces/cups/abandon', { method: 'POST' })
    expect(refused.status).toBe(400)
    expect(await refused.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_NOT_SET' } })

    const { app } = await withPiece()
    const accepted = await app.request('/pieces/cups/abandon', { method: 'POST' })
    expect(accepted.status).toBe(200)
  })

  it('reports the round in flight on the piece before it settles, so a reload mid-round knows what it is watching', async () => {
    const { app, room } = await withPiece(50)

    await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'a message', draft: 'text' }),
    })

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.roundInFlight).not.toBeNull()
    expect(pieceBody.data.roundInFlight.participants).toContain('shape')

    await settlementOf(room, 'cups')
  })

  describe('applying a recommendation', () => {
    /**
     * A round settled over HTTP first, so the piece holds an applicable
     * suggestion at a real round and participant id — the identity an
     * `/apply` request names.
     */
    async function withRecommendation(): Promise<{ app: Hono; room: Room; roundId: string }> {
      const modelAccess = FixtureModelAdapter.bySite(
        {
          shape: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } } },
          apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them, revised.' } } },
        },
        { reachable: true, models: [] },
      )
      const room = buildTestRoom(dataRoot, { modelAccess })
      const { app, workspace } = buildTestApp(dataRoot, { room })

      await workspace.set('my-writing')
      await app.request('/pieces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Cups' }),
      })
      const roundRes = await app.request('/pieces/cups/conversations/c1/rounds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '@shape a direct question', draft: 'The cups sat where she left them.' }),
      })
      const { roundId } = (await roundRes.json()).data
      await settlementOf(room, 'cups')
      return { app, room, roundId }
    }

    it('reaches the manuscript the model returned, on the same request', async () => {
      const { app, roundId } = await withRecommendation()

      const res = await app.request('/pieces/cups/conversations/c1/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roundId, participantId: 'shape', draft: 'The cups sat where she left them.' }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ success: true, data: { outcome: 'applied' } })
    })

    it('refuses an unknown recommendation with RECOMMENDATION_NOT_FOUND', async () => {
      const { app, roundId } = await withRecommendation()

      const res = await app.request('/pieces/cups/conversations/c1/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roundId, participantId: 'compression', draft: 'text' }),
      })

      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ success: false, error: { code: 'RECOMMENDATION_NOT_FOUND' } })
    })

    it('refuses to apply while a round is in flight, with ROOM_BUSY', async () => {
      const behavior: FixtureBehavior = {
        result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } },
        delayMs: 50,
      }
      const modelAccess = FixtureModelAdapter.uniform(behavior, { reachable: true, models: [] })
      const room = buildTestRoom(dataRoot, { modelAccess })
      const { app, workspace } = buildTestApp(dataRoot, { room })
      await workspace.set('my-writing')
      await app.request('/pieces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Cups' }),
      })
      await app.request('/pieces/cups/conversations/c1/rounds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '@shape a direct question', draft: 'text' }),
      })
      await settlementOf(room, 'cups')

      await app.request('/pieces/cups/conversations/c1/rounds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'another message', draft: 'text' }),
      })

      const applyRes = await app.request('/pieces/cups/conversations/c1/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roundId: 'r1', participantId: 'shape', draft: 'text' }),
      })
      expect(applyRes.status).toBe(409)
      expect(await applyRes.json()).toMatchObject({ success: false, error: { code: 'ROOM_BUSY' } })

      await settlementOf(room, 'cups')
    })
  })
})
