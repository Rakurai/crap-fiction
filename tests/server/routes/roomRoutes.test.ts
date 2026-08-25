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

  async function withPiece(delayMs?: number): Promise<{ app: Hono; room: Room }> {
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
    if (settlement === undefined) throw new Error(`no dispatch in flight for "${pieceId}"`)
    return settlement
  }

  it('mints a conversation id that writes nothing until the first dispatch opens', async () => {
    const { app } = await withPiece()

    const res = await app.request('/pieces/cups/conversations', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.data.id).toBe('string')

    const getRes = await app.request(`/pieces/cups/conversations/${body.data.id}`)
    expect(getRes.status).toBe(404)
    expect(await getRes.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })
  })

  it('opens a dispatch over HTTP and reports it no longer in flight once it settles', async () => {
    const { app, room } = await withPiece()

    const dispatchRes = await app.request('/pieces/cups/conversations/c1/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '@shape does the opening earn its length', draft: 'The cups sat where she left them.' }),
    })
    expect(dispatchRes.status).toBe(200)
    const { conversationId, actionId } = (await dispatchRes.json()).data
    expect(typeof conversationId).toBe('string')
    expect(typeof actionId).toBe('string')

    await settlementOf(room, 'cups')

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.currentConversationId).toBe(conversationId)
    expect(pieceBody.data.conversationActionInFlight).toBeNull()
  })

  it('refuses a second author-initiated dispatch while one is in flight, with ROOM_BUSY', async () => {
    const { app, room } = await withPiece(50)

    const first = await app.request('/pieces/cups/conversations/c1/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'a message', draft: 'text' }),
    })
    expect(first.status).toBe(200)

    const second = await app.request('/pieces/cups/conversations/c1/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'another message', draft: 'text' }),
    })
    expect(second.status).toBe(409)
    expect(await second.json()).toMatchObject({ success: false, error: { code: 'ROOM_BUSY' } })

    await settlementOf(room, 'cups')
  })

  it('refuses to abandon before a workspace is set, and abandons nothing afterwards without complaint', async () => {
    const bare = buildTestApp(dataRoot).app

    const refused = await bare.request('/pieces/cups/conversations/c1/actions/a1/abandon', { method: 'POST' })
    expect(refused.status).toBe(400)
    expect(await refused.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_NOT_SET' } })

    const { app } = await withPiece()
    const accepted = await app.request('/pieces/cups/conversations/c1/actions/no-such-action/abandon', { method: 'POST' })
    expect(accepted.status).toBe(200)
  })

  it('targets the named action, so an abandon request naming one already finished never touches the one running now', async () => {
    const { app, room } = await withPiece(50)

    const first = await app.request('/pieces/cups/conversations/c1/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'first', draft: 'text' }),
    })
    const { actionId: firstActionId } = (await first.json()).data
    await settlementOf(room, 'cups')

    const second = await app.request('/pieces/cups/conversations/c1/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'second', draft: 'text' }),
    })
    const { actionId: secondActionId } = (await second.json()).data

    const stale = await app.request(`/pieces/cups/conversations/c1/actions/${firstActionId}/abandon`, { method: 'POST' })
    expect(stale.status).toBe(200)

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.conversationActionInFlight).toMatchObject({ actionId: secondActionId })

    await settlementOf(room, 'cups')
  })

  it('reports the dispatch in flight on the piece before it settles, so a reload mid-dispatch knows what it is watching', async () => {
    const { app, room } = await withPiece(50)

    await app.request('/pieces/cups/conversations/c1/dispatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'a message', draft: 'text' }),
    })

    const pieceRes = await app.request('/pieces/cups')
    const pieceBody = await pieceRes.json()
    expect(pieceBody.data.conversationActionInFlight).not.toBeNull()
    expect(pieceBody.data.conversationActionInFlight.kind).toBe('dispatch')
    expect(pieceBody.data.conversationActionInFlight.audience).toContain('shape')

    await settlementOf(room, 'cups')
  })

  describe('replying and asking for a concrete change', () => {
    async function withCommentary(): Promise<{ app: Hono; room: Room; conversationId: string; responseId: string }> {
      const { app, room } = await withPiece()

      const dispatchRes = await app.request('/pieces/cups/conversations/c1/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'a message', draft: 'text' }),
      })
      const { conversationId } = (await dispatchRes.json()).data
      await settlementOf(room, 'cups')

      const conversationRes = await app.request(`/pieces/cups/conversations/${conversationId}`)
      const { data: conversation } = await conversationRes.json()
      const response = conversation.entries.find((entry: { kind: string }) => entry.kind === 'participantResponse')
      return { app, room, conversationId, responseId: response.id }
    }

    it('sends a reply to the named participant, addressed by the act rather than by the words', async () => {
      const { app, room, conversationId } = await withCommentary()

      const res = await app.request(`/pieces/cups/conversations/${conversationId}/dispatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: 'shape', message: 'say more, @story-editor', draft: 'text' }),
      })
      expect(res.status).toBe(200)
      await settlementOf(room, 'cups')

      const conversationRes = await app.request(`/pieces/cups/conversations/${conversationId}`)
      const { data: conversation } = await conversationRes.json()
      const message = conversation.entries.find((entry: { kind: string; text?: string }) => entry.kind === 'authorMessage' && entry.text === 'say more, @story-editor')
      expect(message.audience).toEqual(['shape'])
    })

    it('asks the named response for a concrete change, opening a dispatch with no author message', async () => {
      const { app, room, conversationId, responseId } = await withCommentary()

      const res = await app.request(`/pieces/cups/conversations/${conversationId}/dispatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ respondingTo: responseId, clarification: 'be specific', draft: 'text' }),
      })
      expect(res.status).toBe(200)
      await settlementOf(room, 'cups')

      const conversationRes = await app.request(`/pieces/cups/conversations/${conversationId}`)
      const { data: conversation } = await conversationRes.json()
      const request = conversation.entries.find((entry: { kind: string }) => entry.kind === 'concreteChangeRequest')
      expect(request).toMatchObject({ respondingTo: responseId, clarification: 'be specific' })
    })

    it('refuses asking about a response that never gave commentary, with COMMENTARY_NOT_FOUND', async () => {
      const { app, conversationId } = await withCommentary()

      const res = await app.request(`/pieces/cups/conversations/${conversationId}/dispatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ respondingTo: 'no-such-response', draft: 'text' }),
      })
      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ success: false, error: { code: 'COMMENTARY_NOT_FOUND' } })
    })

    it('refuses replying to an unknown participant, with PARTICIPANT_NOT_FOUND', async () => {
      const { app, conversationId } = await withCommentary()

      const res = await app.request(`/pieces/cups/conversations/${conversationId}/dispatch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: 'no-such-participant', message: 'a reply', draft: 'text' }),
      })
      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ success: false, error: { code: 'PARTICIPANT_NOT_FOUND' } })
    })
  })

  describe('applying a recommendation', () => {
    async function withRecommendation(): Promise<{ app: Hono; room: Room; responseId: string }> {
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
      await app.request('/pieces/cups/conversations/c1/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: 'shape', message: 'a direct question', draft: 'The cups sat where she left them.' }),
      })
      await settlementOf(room, 'cups')

      const conversationRes = await app.request('/pieces/cups/conversations/c1')
      const { data: conversation } = await conversationRes.json()
      const response = conversation.entries.find((entry: { kind: string }) => entry.kind === 'participantResponse')
      return { app, room, responseId: response.id }
    }

    it('reaches the manuscript the model returned, on the same request', async () => {
      const { app, responseId } = await withRecommendation()

      const res = await app.request('/pieces/cups/conversations/c1/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ responseId, draft: 'The cups sat where she left them.' }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ success: true, data: { outcome: 'applied' } })
    })

    it('presents the applied change on the response that caused it, once the conversation is read back', async () => {
      const { app, responseId } = await withRecommendation()

      const applyRes = await app.request('/pieces/cups/conversations/c1/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ responseId, draft: 'The cups sat where she left them.' }),
      })
      const { data: applied } = await applyRes.json()

      const conversationRes = await app.request('/pieces/cups/conversations/c1')
      const { data: conversation } = await conversationRes.json()
      const application = conversation.entries.find((entry: { kind: string }) => entry.kind === 'application')
      expect(application).toMatchObject({ responseId, changeId: applied.change.id, change: applied.change.content })
    })

    it('refuses an unknown recommendation with RECOMMENDATION_NOT_FOUND', async () => {
      const { app } = await withRecommendation()

      const res = await app.request('/pieces/cups/conversations/c1/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ responseId: 'no-such-response', draft: 'text' }),
      })

      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ success: false, error: { code: 'RECOMMENDATION_NOT_FOUND' } })
    })

    it('reports the apply in flight on the piece before it settles, so a reload mid-apply also knows what it is watching', async () => {
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
      await app.request('/pieces/cups/conversations/c1/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: 'shape', message: 'a direct question', draft: 'text' }),
      })
      await settlementOf(room, 'cups')

      const conversationRes = await app.request('/pieces/cups/conversations/c1')
      const { data: conversation } = await conversationRes.json()
      const response = conversation.entries.find((entry: { kind: string }) => entry.kind === 'participantResponse')

      const applying = app.request('/pieces/cups/conversations/c1/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ responseId: response.id, draft: 'text' }),
      })
      await new Promise((resolve) => setImmediate(resolve))

      const pieceRes = await app.request('/pieces/cups')
      const pieceBody = await pieceRes.json()
      expect(pieceBody.data.conversationActionInFlight).not.toBeNull()
      expect(pieceBody.data.conversationActionInFlight.kind).toBe('apply')
      expect(pieceBody.data.conversationActionInFlight.sourceEntryId).toBe(response.id)

      await applying
    })
  })

  describe('capturing context', () => {
    it('returns the proposals the call made, each with an identity, on the same request', async () => {
      const modelAccess = FixtureModelAdapter.bySite(
        {
          capture: {
            result: {
              outcome: 'value',
              value: { proposals: [{ destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' }] },
            },
          },
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

      const res = await app.request('/pieces/cups/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: 'c1', draft: 'The cups sat where she left them.' }),
      })

      expect(res.status).toBe(200)
      const { data } = await res.json()
      expect(data.outcome).toBe('captured')
      expect(data.proposals).toHaveLength(1)
      expect(typeof data.proposals[0].id).toBe('string')
      expect(data.proposals[0]).toMatchObject({ destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' })
    })

    it('reports capture activity on the piece independently of the dispatch in flight, and clears it once capture settles', async () => {
      const modelAccess = FixtureModelAdapter.bySite(
        { capture: { result: { outcome: 'value', value: { proposals: [] } }, held: true } },
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

      const capturing = app.request('/pieces/cups/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: 'c1', draft: 'text' }),
      })
      await new Promise((resolve) => setImmediate(resolve))

      const pieceRes = await app.request('/pieces/cups')
      const pieceBody = await pieceRes.json()
      expect(pieceBody.data.conversationActionInFlight).toBeNull()
      expect(pieceBody.data.captureInFlight).toMatchObject({ conversationId: 'c1' })

      modelAccess.release('capture')
      await capturing

      const settledRes = await app.request('/pieces/cups')
      expect((await settledRes.json()).data.captureInFlight).toBeNull()
    })

    it('writes only the approved proposals, reporting which destinations landed', async () => {
      const { app, workspace } = buildTestApp(dataRoot)
      await workspace.set('my-writing')
      await app.request('/pieces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Cups' }),
      })

      const res = await app.request('/pieces/cups/capture/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          approved: [{ id: 'p1', destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' }],
        }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ success: true, data: { written: ['storyContext'], failures: [] } })

      const pieceRes = await app.request('/pieces/cups')
      const pieceBody = await pieceRes.json()
      expect(pieceBody.data.storyContext).toEqual({ Premise: ['two cups, one left behind'] })
    })
  })
})
