import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { ConversationEntryStore, writeAppliedChange } from '../../../src/server/store/index.js'
import { buildTestApp } from '../../support/harness.js'

/**
 * What a piece is and how it changes belongs to `pieces.test.ts`, which states it in
 * the studio's own vocabulary. These tests own only what the adapter adds: the paths,
 * the request grammar, the view the routes serialize, and the envelope each stated
 * failure arrives in.
 */

const MODE: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in one sitting.',
  storyContextReference: 'Sections, each holding entries.',
}

const EPIC: ModeDescriptor = {
  id: 'epic',
  displayName: 'Epic',
  description: 'A piece read over several sittings.',
  storyContextReference: 'Sections, each holding entries.',
}

const ROLES: readonly RoleDefinition[] = [
  {
    id: 'shape',
    handle: 'shape',
    displayName: 'Shape',
    description: 'reads for the shape of the whole',
    persona: 'reasons about the shape of the whole',
    eligibility: 'cast',
    availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'story-editor',
    handle: 'editor',
    displayName: 'Story Editor',
    description: 'weighs what the room said',
    persona: 'reasons about what the room said',
    eligibility: 'generalist',
    availability: [],
  },
]

const JSON_HEADERS = { 'content-type': 'application/json' }

describe('the piece routes', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function studio(modes: readonly ModeDescriptor[] = [MODE]) {
    return buildTestApp(dataRoot, { modes, roles: ROLES, runtimeStatus: undefined })
  }

  async function withWorkspace(modes?: readonly ModeDescriptor[]) {
    const { app, workspace } = studio(modes)
    const dir = await workspace.set('my-writing')
    return { app, dir }
  }

  async function withPiece() {
    const { app, dir } = await withWorkspace()
    await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Cups', mode: 'flash' }) })
    return { app, dir }
  }

  it('carries an opened piece whole: its details, its draft, its cast with the roles named, and its conversations', async () => {
    const { app, dir } = await withPiece()
    await app.request('/pieces/cups/draft', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ draft: 'Two small words.' }) })
    await new ConversationEntryStore().append(dir, 'cups', 'c1', {
      id: 'e1',
      kind: 'authorMessage',
      text: 'does the opening earn its length',
      audience: [],
      brought: [],
    })

    const res = await app.request('/pieces/cups')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      success: true,
      data: {
        id: 'cups',
        title: 'Cups',
        mode: 'flash',
        status: 'drafting',
        draft: 'Two small words.',
        cast: [{ id: 'shape', displayName: 'Shape', description: ROLES[0]?.description, enabled: true }],
        conversations: [{ id: 'c1', opening: 'does the opening earn its length', lastActivity: expect.any(Number) }],
      },
    })
  })

  it('carries a conversation the author asks for by id, with the entries it holds', async () => {
    const { app, dir } = await withPiece()
    await new ConversationEntryStore().append(dir, 'cups', 'c1', { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] })

    const res = await app.request('/pieces/cups/conversations/c1')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { id: 'c1', entries: [{ id: 'e1', kind: 'authorMessage' }] } })
  })

  it('reaches the studio on every write it offers, answering each in the envelope', async () => {
    const { app } = await withWorkspace()

    const created = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'The Cups', mode: 'flash' }) })
    expect(await created.json()).toMatchObject({ success: true, data: { id: 'the-cups' } })

    const listed = await app.request('/pieces')
    expect(await listed.json()).toMatchObject({ success: true, data: [{ id: 'the-cups' }] })

    const patched = await app.request('/pieces/the-cups', { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Cups', status: 'finished', cast: [] }) })
    expect(await patched.json()).toMatchObject({ success: true, data: { title: 'Cups', status: 'finished', cast: [{ id: 'shape', enabled: false }] } })

    const saved = await app.request('/pieces/the-cups/draft', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ draft: 'text' }) })
    expect(await saved.json()).toEqual({ success: true, data: null })

    const opened = await app.request('/pieces/the-cups/conversations', { method: 'POST' })
    expect(await opened.json()).toMatchObject({ success: true, data: { id: expect.any(String) } })
  })

  it('deletes a conversation, and the piece stops reporting it', async () => {
    const { app, dir } = await withPiece()
    const store = new ConversationEntryStore()
    await store.append(dir, 'cups', 'c1', { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] })
    await store.append(dir, 'cups', 'c1', { id: 'e2', kind: 'application', responseId: 'e1', changeId: 'change1' })
    await writeAppliedChange(dir, 'cups', { id: 'change1', content: { kind: 'passages', passages: [{ before: 'it', after: '' }] } })

    const res = await app.request('/pieces/cups/conversations/c1', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: null })
    expect((await (await app.request('/pieces/cups')).json()).data.conversations).toEqual([])
  })

  /**
   * Which refusals the studio states at all belongs to `pieces.test.ts` and
   * `store/index.test.ts`. What the adapter owns is the translation: each stated refusal
   * reaching the author as a named code at the status that refusal warrants, never as an
   * unhandled collapse.
   */
  it('translates every refusal the studio states into a named code at its own status', async () => {
    const unconfigured = await studio().app.request('/pieces')
    expect(unconfigured.status).toBe(400)
    expect(await unconfigured.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_NOT_SET' } })

    const { app, dir } = await withPiece()

    const ungrammatical = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) })
    expect(ungrammatical.status).toBe(400)
    expect(await ungrammatical.json()).toMatchObject({ success: false, error: { code: 'INVALID_REQUEST' } })

    const absentPiece = await app.request('/pieces/nothing-here')
    expect(absentPiece.status).toBe(404)
    expect(await absentPiece.json()).toMatchObject({ success: false, error: { code: 'PIECE_NOT_FOUND' } })

    const absentConversation = await app.request('/pieces/cups/conversations/never-written', { method: 'DELETE' })
    expect(absentConversation.status).toBe(404)
    expect(await absentConversation.json()).toMatchObject({ success: false, error: { code: 'CONVERSATION_NOT_FOUND' } })

    const outsideCast = await app.request('/pieces/cups', { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ cast: ['story-editor'] }) })
    expect(outsideCast.status).toBe(400)
    expect(await outsideCast.json()).toMatchObject({ success: false, error: { code: 'CAST_MEMBER_UNKNOWN' } })

    mkdirSync(path.join(dir, 'broken'), { recursive: true })
    writeFileSync(path.join(dir, 'broken', 'piece.yaml'), 'title: Broken\nmode: flash\nstatus: not-a-status\n', 'utf8')
    const corrupted = await app.request('/pieces/broken')
    expect(corrupted.status).toBe(500)
    expect(await corrupted.json()).toMatchObject({ success: false, error: { code: 'ARTIFACT_INVALID' } })

    const unknownMode = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Nope', mode: 'novella' }) })
    expect(unknownMode.status).toBe(400)
    expect(await unknownMode.json()).toMatchObject({ success: false, error: { code: 'MODE_UNKNOWN' } })
  })

  it('lists every loaded mode, and persists whichever the author chooses at creation', async () => {
    const { app } = await withWorkspace([MODE, EPIC])

    const listed = await app.request('/modes')
    expect(await listed.json()).toMatchObject({
      success: true,
      data: [{ id: 'flash', displayName: 'Flash' }, { id: 'epic', displayName: 'Epic' }],
    })

    const created = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'A Long Way', mode: 'epic' }) })
    expect(await created.json()).toMatchObject({ success: true, data: { mode: 'epic' } })

    const opened = await app.request('/pieces/a-long-way')
    expect(await opened.json()).toMatchObject({ success: true, data: { mode: 'epic' } })
  })
})
