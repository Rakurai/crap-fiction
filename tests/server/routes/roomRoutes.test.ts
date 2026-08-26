import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import type { RoomScope } from '../../../src/server/scope.js'
import { SHIPPED_HISTORY_POLICY } from '../../../src/server/room/context.js'
import type { Room } from '../../../src/server/room/room.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../../support/modelAdapter.js'
import { buildTestApp } from '../../support/harness.js'
import { buildTestRoom } from '../../support/room.js'
import { AUTHOR_CONTEXT_REFERENCE_FIXTURE, CHARTER_FIXTURE, INTERVIEWER_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../../support/roomFixtures.js'

/**
 * What the room does with a dispatch or an application belongs to
 * `room/room.test.ts`. These tests own the adapter over it: the act each request body
 * names, the outcome each answer is translated to, and the envelope each stated refusal
 * arrives in.
 *
 * A scenario that needs a call still running holds it at the fixture adapter and
 * releases it, rather than racing a timer; a scenario that needs one finished watches the
 * scope's own activity, since the piece route no longer carries it — the author's studio
 * watches that same fact through the event stream, which `room/room.test.ts` and
 * `studio/devServerStreaming.test.ts` cover at the wire.
 */

const MODE: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in one sitting.',
  storyContextReference: 'Sections, each holding entries.',
}

const ROLES: readonly RoleDefinition[] = [
  {
    id: 'shape',
    handle: 'shape',
    displayName: 'Shape',
    description: 'x',
    persona: 'reasons about x',
    eligibility: 'cast',
    function: undefined,
    availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }],
  },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', description: 'y', persona: 'reasons about y', eligibility: 'generalist', function: undefined, availability: [] },
  INTERVIEWER_FIXTURE,
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

  const draftScope: RoomScope = { pieceId: 'cups', surface: 'draft' }
  const DOCUMENTS = { draft: 'The cups sat where she left them.', storyContext: '', authorContext: '' }

  async function withPiece(
    behaviors: Readonly<Record<string, FixtureBehavior>>,
  ): Promise<{ app: Hono; modelAccess: FixtureModelAdapter; room: Room }> {
    const modelAccess = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
    const room = buildTestRoom(dataRoot, {
      modes: [MODE],
      roles: ROLES,
      charter: CHARTER_FIXTURE,
      fragments: PROMPT_FRAGMENTS_FIXTURE,
      policy: SHIPPED_HISTORY_POLICY,
      modelAccess,
      now: () => 1_700_000_000_000,
      authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
    })
    const { app, workspace } = buildTestApp(dataRoot, {
      modes: [MODE],
      roles: ROLES,
      runtimeStatus: undefined,
      room,
      authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
    })

    await workspace.set('my-writing')
    await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Cups', mode: 'flash' }) })
    return { app, modelAccess, room }
  }

  async function dispatch(app: Hono, conversationId: string, body: Record<string, unknown>): Promise<Response> {
    return await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/dispatch`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ documents: DOCUMENTS, ...body }),
    })
  }

  async function piece(app: Hono) {
    return await (await app.request('/pieces/cups')).json()
  }

  async function conversation(app: Hono, conversationId: string) {
    return await (await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}`)).json()
  }

  /**
   * Waits on the settlement the room itself hands out, so nothing here races a clock, then reads
   * the same in-flight view the author's studio reads to confirm the scope came back to rest.
   */
  async function untilIdle(room: Room): Promise<void> {
    await room.settlement(draftScope)
    const inFlight = room.activitySnapshot(draftScope)
    if (inFlight !== undefined) throw new Error(`the room still reports a ${inFlight.kind} in flight`)
  }

  /** The id of the response a settled dispatch produced, which later acts name. */
  async function respondedTo(app: Hono, room: Room, body: Record<string, unknown>): Promise<string> {
    await dispatch(app, 'c1', body)
    await untilIdle(room)
    const response = (await conversation(app, 'c1')).data.entries.find((entry: { kind: string }) => entry.kind === 'participantResponse')
    if (response === undefined) throw new Error('the dispatch appended no participant response')
    return response.id
  }

  it('mints a conversation id that writes nothing until the first dispatch opens', async () => {
    const { app } = await withPiece({})

    const res = await app.request('/pieces/cups/surfaces/draft/conversations', { method: 'POST' })
    const { id } = (await res.json()).data

    expect(res.status).toBe(200)
    const unopened = await app.request(`/pieces/cups/surfaces/draft/conversations/${id}`)
    expect(unopened.status).toBe(404)
    expect(await unopened.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })
  })

  /**
   * The three acts a dispatch body can name, and the one in-flight view the room itself holds
   * while any of them runs: the first is held so that view is observable, and released so the
   * acts behind it can open in turn.
   */
  it('opens the act each request body names — a message to the room, a reply to one participant, or a concrete change asked of a response — reporting the one in flight with the audience it resolved', async () => {
    const { app, modelAccess, room } = await withPiece({ shape: { ...COMMENTARY, held: true }, 'story-editor': COMMENTARY })

    const opened = await dispatch(app, 'c1', { message: 'a message' })
    const { conversationId, actionId } = (await opened.json()).data
    expect(opened.status).toBe(200)
    expect(typeof actionId).toBe('string')

    const inFlight = room.activitySnapshot(draftScope)
    expect(inFlight).toMatchObject({ kind: 'dispatch', actionId })
    expect(inFlight?.kind === 'dispatch' && inFlight.audience).toContain('shape')

    modelAccess.release('shape')
    await untilIdle(room)
    expect((await piece(app)).data.surfaces.draft.currentConversationId).toBe(conversationId)

    const opening: readonly { kind: string; id: string }[] = (await conversation(app, 'c1')).data.entries
    const responseId = opening.find((entry) => entry.kind === 'participantResponse')?.id
    if (responseId === undefined) throw new Error('the dispatch appended no participant response')

    await dispatch(app, 'c1', { target: 'shape', message: 'say more, @story-editor' })
    await untilIdle(room)
    await dispatch(app, 'c1', { respondingTo: responseId, clarification: 'be specific' })
    await untilIdle(room)

    const entries: readonly { kind: string; text?: string }[] = (await conversation(app, 'c1')).data.entries
    expect(entries.find((entry) => entry.kind === 'authorMessage' && entry.text === 'a message')).toBeDefined()
    // Addressed by the act it was sent as, never by the handle left in the words.
    expect(entries.find((entry) => entry.text === 'say more, @story-editor')).toMatchObject({ audience: ['shape'] })
    expect(entries.find((entry) => entry.kind === 'concreteChangeRequest')).toMatchObject({ respondingTo: responseId, clarification: 'be specific' })
  })

  it('reports an application in flight naming the response it came from, then answers with a pending replacement that becomes the change on that response once confirmed', async () => {
    const { app, modelAccess, room } = await withPiece({
      shape: RECOMMENDATION,
      apply: { result: { outcome: 'value', value: { replacement: 'The cups sat where she left them, revised.' } }, held: true },
    })
    const responseId = await respondedTo(app, room, { target: 'shape', message: 'a direct question' })

    const applying = app.request('/pieces/cups/surfaces/draft/conversations/c1/apply', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId, documents: DOCUMENTS }),
    })
    await new Promise((resolve) => setImmediate(resolve))

    expect(room.activitySnapshot(draftScope)).toMatchObject({ kind: 'apply', sourceEntryId: responseId })

    modelAccess.release('apply')
    const { data: applied } = await (await applying).json()
    expect(applied).toMatchObject({ outcome: 'pending', replacement: 'The cups sat where she left them, revised.' })

    // Still busy: pending, not settled, until the client installs, saves and confirms it.
    expect(room.activitySnapshot(draftScope)).toMatchObject({ kind: 'apply', sourceEntryId: responseId })

    await app.request('/pieces/cups/surfaces/draft/document', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: applied.replacement }),
    })
    const confirming = await app.request(`/pieces/cups/surfaces/draft/conversations/c1/apply/${applied.applicationId}/confirm`, { method: 'POST' })
    expect(confirming.status).toBe(200)
    const { data: confirmed } = await confirming.json()

    expect(room.activitySnapshot(draftScope)).toBeUndefined()
    const entries: readonly { kind: string }[] = (await conversation(app, 'c1')).data.entries
    expect(entries.find((entry) => entry.kind === 'application')).toMatchObject({
      id: confirmed.entryId,
      responseId,
      change: confirmed.change,
    })
  })

  /**
   * The routes a reconnecting client reads its pending replacement back from and confirms it
   * through. Which replacements are pending, and what confirming one before the save requires,
   * are the room's own claims at `room/room.test.ts`.
   */
  it('answers the pending replacement to a client asking for it by its provisional identity, and states the room\'s refusal of a confirmation the save has not caught up with', async () => {
    const { app, modelAccess, room } = await withPiece({
      shape: RECOMMENDATION,
      apply: { result: { outcome: 'value', value: { replacement: 'The cups sat where she left them, revised.' } }, held: true },
    })
    const responseId = await respondedTo(app, room, { target: 'shape', message: 'a direct question' })

    const applying = app.request('/pieces/cups/surfaces/draft/conversations/c1/apply', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId, documents: DOCUMENTS }),
    })
    modelAccess.release('apply')
    const { data: applied } = await (await applying).json()

    const retrieved = await app.request(`/pieces/cups/surfaces/draft/conversations/c1/apply/${applied.applicationId}`)
    expect(retrieved.status).toBe(200)
    expect(await retrieved.json()).toMatchObject({ success: true, data: { replacement: applied.replacement } })

    const unsaved = await app.request(`/pieces/cups/surfaces/draft/conversations/c1/apply/${applied.applicationId}/confirm`, { method: 'POST' })
    expect(unsaved.status).toBe(409)
    expect(await unsaved.json()).toMatchObject({ success: false, error: { code: 'APPLICATION_DOCUMENT_NOT_SAVED' } })
  })

  /** The act that reaches no model at all, and so answers within the request that opened it. */
  it('accepts abandoning an action nothing is running without complaint', async () => {
    const { app, room } = await withPiece({})

    const abandoned = await app.request('/pieces/cups/surfaces/draft/conversations/c1/actions/no-such-action/abandon', { method: 'POST' })

    expect(abandoned.status).toBe(200)
    expect(room.activitySnapshot(draftScope)).toBeUndefined()
  })

  it('states each of the room\'s refusals in the envelope', async () => {
    const { app, modelAccess, room } = await withPiece({ shape: { ...COMMENTARY, held: true }, 'story-editor': COMMENTARY })
    await dispatch(app, 'c1', { message: 'a message' })

    const busy = await dispatch(app, 'c1', { message: 'another message' })
    expect(busy.status).toBe(409)
    expect(await busy.json()).toMatchObject({ success: false, error: { code: 'ROOM_BUSY' } })

    modelAccess.release('shape')
    await untilIdle(room)

    const unknownParticipant = await dispatch(app, 'c1', { target: 'no-such-participant', message: 'a reply' })
    expect(unknownParticipant.status).toBe(404)
    expect(await unknownParticipant.json()).toMatchObject({ success: false, error: { code: 'PARTICIPANT_NOT_FOUND' } })

    const unknownCommentary = await dispatch(app, 'c1', { respondingTo: 'no-such-response' })
    expect(unknownCommentary.status).toBe(404)
    expect(await unknownCommentary.json()).toMatchObject({ success: false, error: { code: 'COMMENTARY_NOT_FOUND' } })

    const unknownRecommendation = await app.request('/pieces/cups/surfaces/draft/conversations/c1/apply', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId: 'no-such-response', documents: { draft: 'text', storyContext: '', authorContext: '' } }),
    })
    expect(unknownRecommendation.status).toBe(404)
    expect(await unknownRecommendation.json()).toMatchObject({ success: false, error: { code: 'RECOMMENDATION_NOT_FOUND' } })

    const unknownApplication = await app.request('/pieces/cups/surfaces/draft/conversations/c1/apply/no-such-application/confirm', { method: 'POST' })
    expect(unknownApplication.status).toBe(404)
    expect(await unknownApplication.json()).toMatchObject({ success: false, error: { code: 'APPLICATION_NOT_PENDING' } })
  })
})
