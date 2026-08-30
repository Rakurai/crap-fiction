import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModeDescriptor } from '../../src/server/modes.js'
import type { ConversationScope } from '../../src/server/scope.js'
import { ConversationEntryStore, writeAppliedChange } from '../../src/server/store/index.js'
import { buildTestApp, idleRoom, idleStudio, UNREACHED_REFERENCE } from '../support/harness.js'
import { MODE_FIXTURE, ROLES_FIXTURE } from '../support/roomFixtures.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import { failureCodeSchema } from '../../src/shared/envelope.js'

const EPIC: ModeDescriptor = {
  id: 'epic',
  displayName: 'Epic',
  description: 'A piece read over several sittings.',
  storyContextReference: 'Sections, each holding entries.',
}

const ONLY_IN_EPIC: RoleDefinition = {
  id: 'sprawl',
  handle: 'sprawl',
  displayName: 'Sprawl',
  description: 'how a long piece holds together',
  mark: 'SP',
  persona: 'reasons about how a long piece holds together',
  eligibility: 'cast',
  function: undefined,
  availability: [{ mode: EPIC.id, surface: 'draft', enabledByDefault: true }],
}

const JSON_HEADERS = { 'content-type': 'application/json' }

function draftScope(workspaceDir: string, pieceId: string): ConversationScope {
  return { kind: 'piece', workspaceDir, pieceId, surface: 'draft' }
}

describe('the piece routes', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function studio(modes: readonly ModeDescriptor[] = [MODE_FIXTURE]) {
    return idleStudio(dataRoot, modes, undefined)
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

  it("carries an opened piece whole, keyed by all three surfaces: its details, each surface's text and conversations", async () => {
    const { app, dir } = await withPiece()
    await app.request('/pieces/cups/surfaces/draft/document', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ text: 'Two small words.' }) })
    await new ConversationEntryStore().append(dataRoot, draftScope(dir, 'cups'), 'c1', {
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
        surfaces: {
          draft: {
            text: 'Two small words.',
            referenceSchema: null,
            conversations: [{ id: 'c1', opening: 'does the opening earn its length', lastActivity: expect.any(Number) }],
          },
          storyContext: { text: '', referenceSchema: MODE_FIXTURE.storyContextReference, conversations: [] },
          authorContext: { text: '', conversations: [] },
        },
      },
    })
  })

  it("serves each surface's whole addressable set, every entry saying what it is to the room: the mode's specialists with their membership, the Story Editor, and the addressed-only participants", async () => {
    const roles = [...ROLES_FIXTURE, ONLY_IN_EPIC]
    const { app, workspace } = buildTestApp(dataRoot, {
      modes: [MODE_FIXTURE, EPIC],
      roles,
      runtimeStatus: undefined,
      room: idleRoom(dataRoot, [MODE_FIXTURE, EPIC], roles),
      authorContextReference: UNREACHED_REFERENCE,
    })
    await workspace.set('my-writing')
    await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Cups', mode: 'flash' }) })
    await app.request('/pieces/cups', { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ cast: { surface: 'draft', ids: [] } }) })

    const { data } = await (await app.request('/pieces/cups')).json()

    expect(data.surfaces.draft.addressable).toEqual([
      { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'x', mark: 'SH', ordinal: 0, eligibility: 'cast', enabled: false },
      { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', description: 'y', mark: 'SE', eligibility: 'generalist' },
      { id: 'interview', handle: 'interview', displayName: 'Interviewer', description: 'q', mark: 'IV', ordinal: 1, eligibility: 'addressed-only' },
    ])
    expect(data.surfaces.storyContext.addressable.map((participant: { id: string }) => participant.id)).toEqual(['story-editor', 'interview'])
  })

  it('carries a conversation the author asks for by id, with the entries it holds', async () => {
    const { app, dir } = await withPiece()
    await new ConversationEntryStore().append(dataRoot, draftScope(dir, 'cups'), 'c1', { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] })

    const res = await app.request('/pieces/cups/surfaces/draft/conversations/c1')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { id: 'c1', entries: [{ id: 'e1', kind: 'authorMessage' }] } })
  })

  it('reaches the studio on every write it offers, answering each in the envelope', async () => {
    const { app } = await withWorkspace()

    const created = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'The Cups', mode: 'flash' }) })
    expect(await created.json()).toMatchObject({ success: true, data: { id: 'the-cups' } })

    const listed = await app.request('/pieces')
    expect(await listed.json()).toMatchObject({ success: true, data: [{ id: 'the-cups' }] })

    const patched = await app.request('/pieces/the-cups', { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Cups', cast: { surface: 'draft', ids: [] } }) })
    const patchedBody = await patched.json()
    expect(patchedBody).toMatchObject({ success: true, data: { title: 'Cups' } })
    expect(patchedBody.data.surfaces.draft.addressable).toContainEqual(expect.objectContaining({ id: 'shape', eligibility: 'cast', enabled: false }))

    const saved = await app.request('/pieces/the-cups/surfaces/draft/document', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ text: 'text' }) })
    expect(await saved.json()).toEqual({ success: true, data: null })

    const opened = await app.request('/pieces/the-cups/surfaces/draft/conversations', { method: 'POST' })
    expect(await opened.json()).toMatchObject({ success: true, data: { id: expect.any(String) } })
  })

  it('deletes a conversation, and the piece stops reporting it', async () => {
    const { app, dir } = await withPiece()
    const scope = draftScope(dir, 'cups')
    const store = new ConversationEntryStore()
    await store.append(dataRoot, scope, 'c1', { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] })
    await store.append(dataRoot, scope, 'c1', { id: 'e2', kind: 'application', responseId: 'e1', changeId: 'change1' })
    await writeAppliedChange(dataRoot, scope, {
      id: 'change1',
      content: { kind: 'passages', passages: [{ leading: '', before: 'it', after: '', trailing: '' }] },
    })

    const res = await app.request('/pieces/cups/surfaces/draft/conversations/c1', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: null })
    expect((await (await app.request('/pieces/cups')).json()).data.surfaces.draft.conversations).toEqual([])
  })

  it('translates every refusal the studio states into a named code at its own status', async () => {
    const unconfigured = await studio().app.request('/pieces')
    expect(unconfigured.status).toBe(400)
    expect(await unconfigured.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.WORKSPACE_NOT_SET } })

    const { app, dir } = await withPiece()

    const ungrammatical = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) })
    expect(ungrammatical.status).toBe(400)
    expect(await ungrammatical.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.INVALID_REQUEST } })

    const absentPiece = await app.request('/pieces/nothing-here')
    expect(absentPiece.status).toBe(404)
    expect(await absentPiece.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.PIECE_NOT_FOUND } })

    const absentConversation = await app.request('/pieces/cups/surfaces/draft/conversations/never-written', { method: 'DELETE' })
    expect(absentConversation.status).toBe(404)
    expect(await absentConversation.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.CONVERSATION_NOT_FOUND } })

    const outsideCast = await app.request('/pieces/cups', { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ cast: { surface: 'draft', ids: ['story-editor'] } }) })
    expect(outsideCast.status).toBe(400)
    expect(await outsideCast.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.CAST_MEMBER_UNKNOWN } })

    mkdirSync(path.join(dir, 'broken'), { recursive: true })
    writeFileSync(path.join(dir, 'broken', 'piece.yaml'), 'title: Broken\nmode: flash\nstatus: not-a-status\n', 'utf8')
    const corrupted = await app.request('/pieces/broken')
    expect(corrupted.status).toBe(500)
    expect(await corrupted.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.ARTIFACT_INVALID } })

    const unknownMode = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'Nope', mode: 'novella' }) })
    expect(unknownMode.status).toBe(400)
    expect(await unknownMode.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.MODE_UNKNOWN } })

    const outside = mkdtempSync(path.join(tmpdir(), 'studio-outside-root-'))
    symlinkSync(outside, path.join(dir, 'escaped'))
    const escaped = await app.request('/pieces', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ title: 'escaped', mode: 'flash' }) })
    expect(escaped.status).toBe(400)
    expect(await escaped.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.PATH_ESCAPES_ROOT } })
    rmSync(outside, { recursive: true, force: true })
  })

  it('lists every loaded mode, and persists whichever the author chooses at creation', async () => {
    const { app } = await withWorkspace([MODE_FIXTURE, EPIC])

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
