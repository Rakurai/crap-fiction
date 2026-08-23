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

function fixtureModelAccess() {
  return new ModelAccess(new FixtureModelAdapter({ result: { outcome: 'abandoned' } }, { reachable: true, models: [] }), () => undefined)
}

function fixtureRoom() {
  return new Room(fixtureModelAccess(), fixtureRoles, CHARTER_FIXTURE, fixtureMode)
}

describe('/workspace', () => {
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

  it('reports no workspace configured', async () => {
    const res = await buildApp().request('/workspace')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { workspace: null } })
  })

  it('sets a workspace inside the data root and reports it afterwards', async () => {
    const app = buildApp()

    const putRes = await app.request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: 'my-writing' }),
    })
    expect(putRes.status).toBe(200)
    const putBody = await putRes.json()
    expect(putBody).toEqual({ success: true, data: { workspace: path.join(dataRoot, 'my-writing') } })

    const getRes = await app.request('/workspace')
    expect(await getRes.json()).toEqual({
      success: true,
      data: { workspace: path.join(dataRoot, 'my-writing') },
    })
  })

  it('refuses a workspace outside the data root with a stated reason, and sets nothing', async () => {
    const app = buildApp()

    const putRes = await app.request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: '/etc/passwd' }),
    })
    expect(putRes.status).toBe(400)
    const body = await putRes.json()
    expect(body).toMatchObject({ success: false, error: { code: 'WORKSPACE_OUTSIDE_ROOT' } })

    const getRes = await app.request('/workspace')
    expect(await getRes.json()).toEqual({ success: true, data: { workspace: null } })
  })

  it('refuses a request body with no workspace field', async () => {
    const app = buildApp()

    const putRes = await app.request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(putRes.status).toBe(400)
    const body = await putRes.json()
    expect(body).toMatchObject({ success: false, error: { code: 'INVALID_REQUEST' } })
  })
})
