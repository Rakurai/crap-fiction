import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { SHIPPED_HISTORY_POLICY } from '../../../src/server/room/context.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../../support/modelAdapter.js'
import { buildTestApp } from '../../support/harness.js'
import { buildTestRoom } from '../../support/room.js'
import { CHARTER_FIXTURE } from '../../support/roomFixtures.js'

/**
 * What the room does with a dispatch, an application or a capture belongs to
 * `room/room.test.ts`. These tests own the adapter over it: the act each request body
 * names, the outcome each answer is translated to, the in-flight views a reload reads,
 * and the envelope each stated refusal arrives in.
 *
 * A scenario that needs a call still running holds it at the fixture adapter and
 * releases it, rather than racing a timer; a scenario that needs one finished watches
 * the piece through the same route the author's studio watches it through.
 */

const MODE: ModeDescriptor = { id: 'flash', displayName: 'Flash', description: 'A short piece read in one sitting.' }

const ROLES: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'x', persona: 'reasons about x', eligibility: 'cast' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', description: 'y', persona: 'reasons about y', eligibility: 'generalist' },
]

const JSON_HEADERS = { 'content-type': 'application/json' }
const COMMENTARY: FixtureBehavior = { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading' } } }
const RECOMMENDATION: FixtureBehavior = {
  result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } },
}

describe('the room over HTTP', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  async function withPiece(
    behaviors: Readonly<Record<string, FixtureBehavior>>,
  ): Promise<{ app: Hono; modelAccess: FixtureModelAdapter }> {
    const modelAccess = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
    const room = buildTestRoom(dataRoot, {
      mode: MODE,
      roles: ROLES,
      charter: CHARTER_FIXTURE,
      policy: SHIPPED_HISTORY_POLICY,
      modelAccess,
      now: () => 1_700_000_000_000,
    })
    const { app, workspace } = buildTestApp(dataRoot, { mode: MODE, roles: ROLES, runtimeStatus: undefined, room })

    await workspace.set('my-writing')
    await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Cups' }) })
    return { app, modelAccess }
  }

  async function dispatch(app: Hono, conversationId: string, body: Record<string, unknown>): Promise<Response> {
    return await app.request(`/pieces/cups/conversations/${conversationId}/dispatch`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ draft: 'The cups sat where she left them.', ...body }),
    })
  }

  async function piece(app: Hono) {
    return await (await app.request('/pieces/cups')).json()
  }

  async function conversation(app: Hono, conversationId: string) {
    return await (await app.request(`/pieces/cups/conversations/${conversationId}`)).json()
  }

  /** Watched through the route the author's studio watches, rather than through the room. */
  async function untilIdle(app: Hono): Promise<void> {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      if ((await piece(app)).data.conversationActionInFlight === null) return
      await new Promise((resolve) => setImmediate(resolve))
    }
    throw new Error('the piece still reports a conversation action in flight')
  }

  /** The id of the response a settled dispatch produced, which later acts name. */
  async function respondedTo(app: Hono, body: Record<string, unknown>): Promise<string> {
    await dispatch(app, 'c1', body)
    await untilIdle(app)
    const response = (await conversation(app, 'c1')).data.entries.find((entry: { kind: string }) => entry.kind === 'participantResponse')
    if (response === undefined) throw new Error('the dispatch appended no participant response')
    return response.id
  }

  it('mints a conversation id that writes nothing until the first dispatch opens', async () => {
    const { app } = await withPiece({})

    const res = await app.request('/pieces/cups/conversations', { method: 'POST' })
    const { id } = (await res.json()).data

    expect(res.status).toBe(200)
    const unopened = await app.request(`/pieces/cups/conversations/${id}`)
    expect(unopened.status).toBe(404)
    expect(await unopened.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })
  })

  /**
   * The three acts a dispatch body can name, and the one in-flight view a reload reads while
   * any of them runs: the first is held so that view is observable, and released so the acts
   * behind it can open in turn.
   */
  it('opens the act each request body names — a message to the room, a reply to one participant, or a concrete change asked of a response — reporting the one in flight with the audience it resolved', async () => {
    const { app, modelAccess } = await withPiece({ shape: { ...COMMENTARY, held: true }, 'story-editor': COMMENTARY })

    const opened = await dispatch(app, 'c1', { message: 'a message' })
    const { conversationId, actionId } = (await opened.json()).data
    expect(opened.status).toBe(200)
    expect(typeof actionId).toBe('string')

    const inFlight = (await piece(app)).data.conversationActionInFlight
    expect(inFlight).toMatchObject({ kind: 'dispatch', actionId })
    expect(inFlight.audience).toContain('shape')

    modelAccess.release('shape')
    await untilIdle(app)
    expect((await piece(app)).data.currentConversationId).toBe(conversationId)

    const opening: readonly { kind: string; id: string }[] = (await conversation(app, 'c1')).data.entries
    const responseId = opening.find((entry) => entry.kind === 'participantResponse')?.id
    if (responseId === undefined) throw new Error('the dispatch appended no participant response')

    await dispatch(app, 'c1', { target: 'shape', message: 'say more, @story-editor' })
    await untilIdle(app)
    await dispatch(app, 'c1', { respondingTo: responseId, clarification: 'be specific' })
    await untilIdle(app)

    const entries: readonly { kind: string; text?: string }[] = (await conversation(app, 'c1')).data.entries
    expect(entries.find((entry) => entry.kind === 'authorMessage' && entry.text === 'a message')).toBeDefined()
    // Addressed by the act it was sent as, never by the handle left in the words.
    expect(entries.find((entry) => entry.text === 'say more, @story-editor')).toMatchObject({ audience: ['shape'] })
    expect(entries.find((entry) => entry.kind === 'concreteChangeRequest')).toMatchObject({ respondingTo: responseId, clarification: 'be specific' })
  })

  it('reports an application in flight naming the response it came from, then answers with the manuscript and shows the change on that response', async () => {
    const { app, modelAccess } = await withPiece({
      shape: RECOMMENDATION,
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them, revised.' } }, held: true },
    })
    const responseId = await respondedTo(app, { target: 'shape', message: 'a direct question' })

    const applying = app.request('/pieces/cups/conversations/c1/apply', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId, draft: 'The cups sat where she left them.' }),
    })
    await new Promise((resolve) => setImmediate(resolve))

    expect((await piece(app)).data.conversationActionInFlight).toMatchObject({ kind: 'apply', sourceEntryId: responseId })

    modelAccess.release('apply')
    const { data: applied } = await (await applying).json()
    expect(applied).toMatchObject({ outcome: 'applied', manuscript: 'The cups sat where she left them, revised.' })

    const entries: readonly { kind: string }[] = (await conversation(app, 'c1')).data.entries
    expect(entries.find((entry) => entry.kind === 'application')).toMatchObject({ responseId, changeId: applied.change.id, change: applied.change.content })
  })

  it('reports a capture in flight beside a conversation that has none, and answers with the proposals the call made, each given an identity', async () => {
    const { app, modelAccess } = await withPiece({
      capture: {
        result: {
          outcome: 'value',
          value: { proposals: [{ destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' }] },
        },
        held: true,
      },
    })

    const capturing = app.request('/pieces/cups/capture', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ conversationId: 'c1', draft: 'The cups sat where she left them.' }),
    })
    await new Promise((resolve) => setImmediate(resolve))

    const watching = (await piece(app)).data
    expect(watching.conversationActionInFlight).toBeNull()
    expect(watching.captureInFlight).toMatchObject({ conversationId: 'c1' })

    modelAccess.release('capture')
    const { data } = await (await capturing).json()

    expect(data.outcome).toBe('captured')
    expect(data.proposals).toHaveLength(1)
    expect(data.proposals[0]).toMatchObject({ id: expect.any(String), destination: 'storyContext', section: 'Premise', text: 'two cups, one left behind' })
    expect((await piece(app)).data.captureInFlight).toBeNull()
  })

  /** The two acts that reach no model at all, and so answer within the request that opened them. */
  it('reports which destinations the approved proposals landed in, and accepts abandoning an action nothing is running without complaint', async () => {
    const { app } = await withPiece({})

    const approved = await app.request('/pieces/cups/capture/approve', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        approved: [{ id: 'p1', destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' }],
      }),
    })

    expect(approved.status).toBe(200)
    expect(await approved.json()).toMatchObject({ success: true, data: { written: ['storyContext'], failures: [] } })
    expect((await piece(app)).data.storyContext).toEqual({ Premise: ['two cups, one left behind'] })

    const abandoned = await app.request('/pieces/cups/conversations/c1/actions/no-such-action/abandon', { method: 'POST' })

    expect(abandoned.status).toBe(200)
    expect((await piece(app)).data.conversationActionInFlight).toBeNull()
  })

  it('states each of the room\'s refusals in the envelope', async () => {
    const { app, modelAccess } = await withPiece({ shape: { ...COMMENTARY, held: true }, 'story-editor': COMMENTARY })
    await dispatch(app, 'c1', { message: 'a message' })

    const busy = await dispatch(app, 'c1', { message: 'another message' })
    expect(busy.status).toBe(409)
    expect(await busy.json()).toMatchObject({ success: false, error: { code: 'ROOM_BUSY' } })

    modelAccess.release('shape')
    await untilIdle(app)

    const unknownParticipant = await dispatch(app, 'c1', { target: 'no-such-participant', message: 'a reply' })
    expect(unknownParticipant.status).toBe(404)
    expect(await unknownParticipant.json()).toMatchObject({ success: false, error: { code: 'PARTICIPANT_NOT_FOUND' } })

    const unknownCommentary = await dispatch(app, 'c1', { respondingTo: 'no-such-response' })
    expect(unknownCommentary.status).toBe(404)
    expect(await unknownCommentary.json()).toMatchObject({ success: false, error: { code: 'COMMENTARY_NOT_FOUND' } })

    const unknownRecommendation = await app.request('/pieces/cups/conversations/c1/apply', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId: 'no-such-response', draft: 'text' }),
    })
    expect(unknownRecommendation.status).toBe(404)
    expect(await unknownRecommendation.json()).toMatchObject({ success: false, error: { code: 'RECOMMENDATION_NOT_FOUND' } })
  })
})
