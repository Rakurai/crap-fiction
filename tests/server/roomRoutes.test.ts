import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/server/app.js'
import type { StudioEnv } from '../../src/server/env.js'
import { FixtureModelAdapter } from '../fixtures/modelAdapter.js'
import { CHARTER_FIXTURE } from '../fixtures/charter.js'
import { callSites } from '../../src/server/model/callSites.js'
import { ModelAccess } from '../../src/server/model/modelAccess.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { DraftWriter } from '../../src/server/pieces.js'
import { Room } from '../../src/server/room/room.js'
import { WorkspaceRegistry } from '../../src/server/workspace.js'

const fixtureMode: ModeDescriptor = { id: 'flash', name: 'Flash', cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }] }

const fixtureRoles = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]
const fixtureSites = callSites(fixtureRoles)

// Conforms to both the eligible and the owed response schema, so one fixture
// behaviour serves every call site in these routes-level tests.
const CONFORMING_RESULT = { outcome: 'value' as const, value: { outcome: 'commentary' as const, claim: 'a reading' } }

describe('the room over HTTP', () => {
  let dataRoot: string
  let env: StudioEnv

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    env = Object.freeze({ dataRoot, port: 4000, modelRuntimeUrl: 'http://localhost:1234', logLevel: 'silent' as const })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function buildApp(delayMs?: number) {
    const workspace = new WorkspaceRegistry(dataRoot)
    workspace.load()
    const behavior = delayMs === undefined ? { result: CONFORMING_RESULT } : { result: CONFORMING_RESULT, delayMs }
    const adapter = new FixtureModelAdapter(behavior, { reachable: true, models: [] })
    const modelAccess = new ModelAccess(adapter, (site) => site)
    const room = new Room(modelAccess, fixtureRoles, CHARTER_FIXTURE, fixtureMode)
    const app = createApp(env, workspace, fixtureMode, new DraftWriter(), fixtureSites, modelAccess, room)
    return { app, workspace }
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

  it('opens a round addressed to one specialist, settles it, and a reload shows the response from the conversation file', async () => {
    const app = await withPiece()

    const roundRes = await app.request('/pieces/cups/conversations/c1/rounds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '@shape does the opening earn its length', draft: 'The cups sat where she left them.' }),
    })
    expect(roundRes.status).toBe(200)
    const { conversationId, roundId } = (await roundRes.json()).data

    await waitForSettled(app, 'cups')

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.currentConversationId).toBe(conversationId)
    expect(pieceBody.data.roundInFlight).toBeNull()

    const conversationRes = await app.request(`/pieces/cups/conversations/${conversationId}`)
    const conversationBody = await conversationRes.json()
    expect(conversationBody.data.rounds).toHaveLength(1)
    expect(conversationBody.data.rounds[0].id).toBe(roundId)
    expect(conversationBody.data.rounds[0].outcome).toBe('settled')
    expect(conversationBody.data.rounds[0].participants).toEqual([
      { participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'a reading' } },
    ])
    // Addressed to Shape alone: no Story Editor call.
    expect(conversationBody.data.rounds[0].participants.map((p: { participantId: string }) => p.participantId)).not.toContain('story-editor')
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
