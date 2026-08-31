import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '../../src/server/logger.js'
import type { RoomScope } from '../../src/server/scope.js'
import { SHIPPED_HISTORY_POLICY } from '../../src/server/room/context.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../support/modelAdapter.js'
import { buildTestApp } from '../support/harness.js'
import { ConversationEntryStore } from '../../src/server/store/index.js'
import { buildTestRoom } from '../support/room.js'
import { AUTHOR_CONTEXT_REFERENCE_FIXTURE, CHARTER_FIXTURE, MODE_FIXTURE, PROMPT_FRAGMENTS_FIXTURE, ROLES_FIXTURE } from '../support/roomFixtures.js'
import { failureCodeSchema } from '../../src/shared/envelope.js'

const JSON_HEADERS = { 'content-type': 'application/json' }
const COMMENTARY: FixtureBehavior = { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading' } } }
const RECOMMENDATION: FixtureBehavior = {
  result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } },
}

type Frame = Readonly<{ type: string; data: Record<string, unknown> }>

type Frames = Readonly<{ frame: (type: string) => Promise<Frame>; close: () => void }>

describe('the room over HTTP', () => {
  let dataRoot: string
  const streams: Array<() => void> = []

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    for (const close of streams) close()
    streams.length = 0
    rmSync(dataRoot, { recursive: true, force: true })
  })

  const draftScope: RoomScope = { pieceId: 'cups', surface: 'draft' }
  const DOCUMENTS = { draft: 'The cups sat where she left them.', storyContext: '', authorContext: '' }

  async function withPiece(
    behaviors: Readonly<Record<string, FixtureBehavior>>,
  ): Promise<{ app: Hono; modelAccess: FixtureModelAdapter; conversationId: string }> {
    const modelAccess = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
    const room = buildTestRoom(dataRoot, {
      modes: [MODE_FIXTURE],
      roles: ROLES_FIXTURE,
      charter: CHARTER_FIXTURE,
      fragments: PROMPT_FRAGMENTS_FIXTURE,
      policy: SHIPPED_HISTORY_POLICY,
      applying: { rounds: 3 },
      modelAccess,
      entries: new ConversationEntryStore(),
      logger: createLogger('silent'),
      now: () => 1_700_000_000_000,
      authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
    })
    const { app, workspace } = buildTestApp(dataRoot, {
      modes: [MODE_FIXTURE],
      roles: ROLES_FIXTURE,
      runtimeStatus: undefined,
      room,
      authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
    })

    await workspace.set('my-writing')
    await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Cups', mode: 'flash' }) })
    const minted = await app.request('/pieces/cups/surfaces/draft/conversations', { method: 'POST' })
    const { id: conversationId } = (await minted.json()).data
    return { app, modelAccess, conversationId }
  }

  function served(app: Hono): Frames {
    const received: Frame[] = []
    let cursor = 0
    let failure: unknown
    let announce: (() => void) | undefined
    const controller = new AbortController()
    streams.push(() => controller.abort())

    void (async () => {
      const opened = await app.request(`/pieces/${draftScope.pieceId}/events`, { signal: controller.signal })
      if (opened.body === null) throw new Error('the events route answered without a stream')
      const reader = opened.body.pipeThrough(new TextDecoderStream()).getReader()
      let unframed = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        unframed += value
        const blocks = unframed.split('\n\n')
        unframed = blocks.pop() ?? ''
        for (const block of blocks) {
          const type = /^event: (.+)$/m.exec(block)?.[1]
          const data = /^data: (.+)$/m.exec(block)?.[1]
          if (type === undefined || data === undefined) throw new Error(`the events route framed something unreadable: ${block}`)
          received.push({ type, data: JSON.parse(data) })
        }
        announce?.()
      }
    })().catch((err: unknown) => {
      failure = err
      announce?.()
    })

    return {
      frame: (type) =>
        new Promise<Frame>((resolve, reject) => {
          const take = (): boolean => {
            if (failure !== undefined) {
              reject(failure instanceof Error ? failure : new Error(String(failure)))
              return true
            }
            while (cursor < received.length) {
              const frame = received[cursor]
              cursor += 1
              if (frame?.type === type) {
                resolve(frame)
                return true
              }
            }
            return false
          }
          announce = undefined
          if (take()) return
          announce = () => {
            if (take()) announce = undefined
          }
        }),
      close: () => controller.abort(),
    }
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

  async function respondedTo(app: Hono, frames: Frames, conversationId: string, body: Record<string, unknown>): Promise<string> {
    await dispatch(app, conversationId, body)
    await frames.frame('action.finished')
    const response = (await conversation(app, conversationId)).data.entries.find((entry: { kind: string }) => entry.kind === 'participantResponse')
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
    expect(await unopened.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.CONVERSATION_NOT_FOUND } })
  })

  it('opens the act each request body names — a message to the room, a reply to one participant, or a concrete change asked of a response', async () => {
    const { app, modelAccess, conversationId } = await withPiece({ shape: { ...COMMENTARY, held: true }, 'story-editor': COMMENTARY })
    const frames = served(app)
    await frames.frame('activity.snapshot')

    const opened = await dispatch(app, conversationId, { message: 'a message' })
    const openedAction = (await opened.json()).data
    const actionId = openedAction.actionId
    expect(opened.status).toBe(200)
    expect(openedAction.conversationId).toBe(conversationId)
    expect(typeof actionId).toBe('string')

    modelAccess.release('shape')
    await frames.frame('action.finished')
    expect((await piece(app)).data.surfaces.draft.currentConversationId).toBe(conversationId)

    const opening: readonly { kind: string; id: string }[] = (await conversation(app, conversationId)).data.entries
    const responseId = opening.find((entry) => entry.kind === 'participantResponse')?.id
    if (responseId === undefined) throw new Error('the dispatch appended no participant response')

    await dispatch(app, conversationId, { target: 'shape', message: 'say more, @story-editor' })
    await frames.frame('action.finished')
    await dispatch(app, conversationId, { respondingTo: responseId, clarification: 'be specific' })
    await frames.frame('action.finished')

    const entries: readonly { kind: string; text?: string }[] = (await conversation(app, conversationId)).data.entries
    expect(entries.find((entry) => entry.kind === 'authorMessage' && entry.text === 'a message')).toBeDefined()
    expect(entries.find((entry) => entry.text === 'say more, @story-editor')).toMatchObject({ audience: ['shape'] })
    expect(entries.find((entry) => entry.kind === 'concreteChangeRequest')).toMatchObject({ respondingTo: responseId, clarification: 'be specific' })
  })

  it('serves the room\'s activity as frames on the event stream, opening with a snapshot of every surface', async () => {
    const { app, modelAccess, conversationId } = await withPiece({ shape: { ...COMMENTARY, held: true }, 'story-editor': COMMENTARY })
    const frames = served(app)

    expect((await frames.frame('activity.snapshot')).data).toEqual({ draft: null, storyContext: null, authorContext: null })

    const opened = await dispatch(app, conversationId, { message: 'a message' })
    const { actionId } = (await opened.json()).data

    expect((await frames.frame('action.started')).data).toMatchObject({
      actionId,
      conversationId,
      kind: 'dispatch',
      surface: draftScope.surface,
    })

    modelAccess.release('shape')
    expect((await frames.frame('action.finished')).data).toMatchObject({ actionId, outcome: 'settled', surface: draftScope.surface })
  })

  it('reports an application in flight naming the response it came from, then answers with a pending replacement that becomes the change on that response once confirmed', async () => {
    const { app, modelAccess, conversationId } = await withPiece({
      shape: RECOMMENDATION,
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'them.', replace: 'them, revised.' }] } }, held: true },
    })
    const frames = served(app)
    await frames.frame('activity.snapshot')
    const responseId = await respondedTo(app, frames, conversationId, { target: 'shape', message: 'a direct question' })

    const applying = app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/apply`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId, documents: DOCUMENTS }),
    })

    expect((await frames.frame('action.started')).data).toMatchObject({ kind: 'apply', sourceEntryId: responseId })

    modelAccess.release('apply')
    const { data: applied } = await (await applying).json()
    expect(applied).toMatchObject({ outcome: 'pending', replacement: 'The cups sat where she left them, revised.' })

    await app.request('/pieces/cups/surfaces/draft/document', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: applied.replacement }),
    })
    const confirming = await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/apply/${applied.applicationId}/confirm`, { method: 'POST' })
    expect(confirming.status).toBe(200)
    const { data: confirmed } = await confirming.json()

    expect((await frames.frame('action.finished')).data).toMatchObject({ outcome: 'settled', surface: draftScope.surface })
    const entries: readonly { kind: string }[] = (await conversation(app, conversationId)).data.entries
    expect(entries.find((entry) => entry.kind === 'application')).toMatchObject({
      id: confirmed.entryId,
      responseId,
      change: confirmed.change,
    })
  })

  it('answers the pending replacement to a client asking for it by its provisional identity, and states the room\'s refusal of a confirmation the save has not caught up with', async () => {
    const { app, modelAccess, conversationId } = await withPiece({
      shape: RECOMMENDATION,
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'them.', replace: 'them, revised.' }] } }, held: true },
    })
    const frames = served(app)
    await frames.frame('activity.snapshot')
    const responseId = await respondedTo(app, frames, conversationId, { target: 'shape', message: 'a direct question' })

    const applying = app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/apply`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId, documents: DOCUMENTS }),
    })
    modelAccess.release('apply')
    const { data: applied } = await (await applying).json()

    const retrieved = await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/apply/${applied.applicationId}`)
    expect(retrieved.status).toBe(200)
    expect(await retrieved.json()).toMatchObject({ success: true, data: { replacement: applied.replacement } })

    const unsaved = await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/apply/${applied.applicationId}/confirm`, { method: 'POST' })
    expect(unsaved.status).toBe(409)
    expect(await unsaved.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.APPLICATION_DOCUMENT_NOT_SAVED } })
  })

  it('accepts abandoning an action nothing is running without complaint', async () => {
    const { app } = await withPiece({})

    const abandoned = await app.request('/pieces/cups/surfaces/draft/conversations/c1/actions/no-such-action/abandon', { method: 'POST' })

    expect(abandoned.status).toBe(200)
    expect(await abandoned.json()).toMatchObject({ success: true, data: null })
  })

  it('states each of the room\'s refusals in the envelope', async () => {
    const { app, modelAccess, conversationId } = await withPiece({ shape: { ...COMMENTARY, held: true }, 'story-editor': COMMENTARY })
    const frames = served(app)
    await frames.frame('activity.snapshot')
    await dispatch(app, conversationId, { message: 'a message' })

    const busy = await dispatch(app, conversationId, { message: 'another message' })
    expect(busy.status).toBe(409)
    expect(await busy.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.ROOM_BUSY } })

    const deletingBusy = await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}`, { method: 'DELETE' })
    expect(deletingBusy.status).toBe(409)
    expect(await deletingBusy.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.ROOM_BUSY } })

    modelAccess.release('shape')
    await frames.frame('action.finished')

    const unknownParticipant = await dispatch(app, conversationId, { target: 'no-such-participant', message: 'a reply' })
    expect(unknownParticipant.status).toBe(404)
    expect(await unknownParticipant.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.PARTICIPANT_NOT_FOUND } })

    const unknownCommentary = await dispatch(app, conversationId, { respondingTo: 'no-such-response' })
    expect(unknownCommentary.status).toBe(404)
    expect(await unknownCommentary.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.COMMENTARY_NOT_FOUND } })

    const unknownRecommendation = await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/apply`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responseId: 'no-such-response', documents: { draft: 'text', storyContext: '', authorContext: '' } }),
    })
    expect(unknownRecommendation.status).toBe(404)
    expect(await unknownRecommendation.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.RECOMMENDATION_NOT_FOUND } })

    const unknownApplication = await app.request(`/pieces/cups/surfaces/draft/conversations/${conversationId}/apply/no-such-application/confirm`, { method: 'POST' })
    expect(unknownApplication.status).toBe(404)
    expect(await unknownApplication.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.APPLICATION_NOT_PENDING } })
  })
})
