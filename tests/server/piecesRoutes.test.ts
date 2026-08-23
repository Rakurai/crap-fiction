import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

function fixtureModelAccess() {
  return new ModelAccess(new FixtureModelAdapter({ result: { outcome: 'abandoned' } }, { reachable: true, models: [] }), () => undefined)
}

function fixtureRoom() {
  return new Room(fixtureModelAccess(), fixtureRoles, CHARTER_FIXTURE, fixtureMode)
}

describe('/pieces', () => {
  let dataRoot: string
  let env: StudioEnv

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    env = Object.freeze({
      dataRoot,
      port: 4000,
      modelRuntimeUrl: 'http://localhost:1234',
      logLevel: 'silent' as const,
    })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function buildApp() {
    const workspace = new WorkspaceRegistry(dataRoot)
    workspace.load()
    const app = createApp(env, workspace, fixtureMode, new DraftWriter(), fixtureSites, fixtureModelAccess(), fixtureRoom())
    return { app, workspace }
  }

  async function withWorkspace() {
    const { app, workspace } = buildApp()
    await workspace.set('my-writing')
    return app
  }

  it('refuses to list pieces with no workspace configured', async () => {
    const { app } = buildApp()
    const res = await app.request('/pieces')
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_NOT_SET' } })
  })

  it('creates a piece from a title alone and lists it afterwards', async () => {
    const app = await withWorkspace()

    const postRes = await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'The Cups' }),
    })
    expect(postRes.status).toBe(200)
    const postBody = await postRes.json()
    expect(postBody).toMatchObject({ success: true, data: { id: 'the-cups', title: 'The Cups', mode: 'flash', status: 'drafting' } })

    const listRes = await app.request('/pieces')
    const listBody = await listRes.json()
    expect(listBody).toMatchObject({ success: true, data: [{ id: 'the-cups', title: 'The Cups' }] })
  })

  it('refuses a piece with no title', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'INVALID_REQUEST' } })
  })

  it('opens a created piece by id', async () => {
    const app = await withWorkspace()
    await app.request('/pieces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Cups' }),
    })

    const res = await app.request('/pieces/cups')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, data: { id: 'cups', title: 'Cups' } })
  })

  it('reports a piece that does not exist as PIECE_NOT_FOUND', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces/nothing-here')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'PIECE_NOT_FOUND' } })
  })

  it('reports a hand-corrupted piece.yaml as a stated ARTIFACT_INVALID failure, in the envelope', async () => {
    const { app, workspace } = buildApp()
    const dir = await workspace.set('my-writing')
    mkdirSync(path.join(dir, 'broken'), { recursive: true })
    writeFileSync(path.join(dir, 'broken', 'piece.yaml'), 'title: Broken\nmode: flash\nstatus: not-a-status\n', 'utf8')

    const res = await app.request('/pieces/broken')
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'ARTIFACT_INVALID' } })
  })

  it('saves a draft as Markdown and reports it back on the next open', async () => {
    const { app, workspace } = buildApp()
    const dir = await workspace.set('my-writing')
    mkdirSync(path.join(dir, 'cups'), { recursive: true })
    writeFileSync(
      path.join(dir, 'cups', 'piece.yaml'),
      'title: Cups\nmode: flash\nstatus: drafting\ncast:\n  - shape\n',
      'utf8',
    )

    const putRes = await app.request('/pieces/cups/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'Two small words.' }),
    })
    expect(putRes.status).toBe(200)
    expect(await putRes.json()).toEqual({ success: true, data: null })

    const getRes = await app.request('/pieces/cups')
    expect(await getRes.json()).toMatchObject({ success: true, data: { draft: 'Two small words.' } })
  })

  it('reports saving a draft for a piece that does not exist as PIECE_NOT_FOUND', async () => {
    const app = await withWorkspace()
    const res = await app.request('/pieces/nothing-here/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'text' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'PIECE_NOT_FOUND' } })
  })

  it('refuses to save a draft with no workspace configured', async () => {
    const { app } = buildApp()
    const res = await app.request('/pieces/cups/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'text' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_NOT_SET' } })
  })
})

describe('/theme', () => {
  let dataRoot: string
  let env: StudioEnv

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    env = Object.freeze({
      dataRoot,
      port: 4000,
      modelRuntimeUrl: 'http://localhost:1234',
      logLevel: 'silent' as const,
    })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function buildApp() {
    const workspace = new WorkspaceRegistry(dataRoot)
    workspace.load()
    return createApp(env, workspace, fixtureMode, new DraftWriter(), fixtureSites, fixtureModelAccess(), fixtureRoom())
  }

  it('reports no theme chosen when none was ever set', async () => {
    const res = await buildApp().request('/theme')
    expect(await res.json()).toEqual({ success: true, data: { theme: null } })
  })

  it('echoes the envelope for a theme it accepted', async () => {
    const app = buildApp()
    const putRes = await app.request('/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    })
    expect(await putRes.json()).toEqual({ success: true, data: { theme: 'dark' } })
  })

  it('refuses a theme that is neither light nor dark', async () => {
    const app = buildApp()
    const res = await app.request('/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'sepia' }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'INVALID_REQUEST' } })
  })
})
