import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/server/app.js'
import type { StudioEnv } from '../../src/server/env.js'
import { FixtureModelAdapter } from '../fixtures/modelAdapter.js'
import { ModelAccess } from '../../src/server/model/modelAccess.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { DraftWriter } from '../../src/server/pieces.js'
import { WorkspaceRegistry } from '../../src/server/workspace.js'

const fixtureModes: readonly ModeDescriptor[] = [
  { id: 'flash', name: 'Flash', cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }] },
]

const fixtureRoles = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'attends to the turn' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'the generalist' },
]

describe('call sites and models', () => {
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

  function buildApp(runtimeStatus: { reachable: true; models: readonly string[] } | { reachable: false } = { reachable: true, models: [] }) {
    const workspace = new WorkspaceRegistry(dataRoot)
    workspace.load()
    const adapter = new FixtureModelAdapter({ result: { outcome: 'abandoned' } }, runtimeStatus)
    const modelAccess = new ModelAccess(adapter, () => undefined)
    return createApp(env, workspace, fixtureModes, new DraftWriter(), fixtureRoles, modelAccess)
  }

  it('lists every call site, its role description where it has one, and no assignment yet', async () => {
    const res = await buildApp().request('/call-sites')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      success: true,
      data: [
        { site: 'shape', displayName: 'Shape', roleDescription: 'attends to the turn', assignment: null },
        { site: 'story-editor', displayName: 'Story Editor', roleDescription: 'the generalist', assignment: null },
        { site: 'apply', displayName: null, roleDescription: null, assignment: null },
        { site: 'capture', displayName: null, roleDescription: null, assignment: null },
      ],
    })
  })

  it('assigns one call site without touching another, and the assignment is visible on the next read', async () => {
    const app = buildApp()

    const putRes = await app.request('/call-sites/shape/assignment', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3' }),
    })
    expect(putRes.status).toBe(200)
    expect(await putRes.json()).toEqual({ success: true, data: { site: 'shape', assignment: 'llama-3' } })

    const getRes = await app.request('/call-sites')
    const body = await getRes.json()
    expect(body.data.find((site: { site: string }) => site.site === 'shape').assignment).toBe('llama-3')
    expect(body.data.find((site: { site: string }) => site.site === 'story-editor').assignment).toBeNull()
  })

  it('refuses an assignment for a call site that does not exist', async () => {
    const app = buildApp()

    const res = await app.request('/call-sites/no-such-site/assignment', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3' }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'CALL_SITE_NOT_FOUND' } })
  })

  it('reports the runtime unreachable rather than a network error', async () => {
    const res = await buildApp({ reachable: false }).request('/models')
    expect(await res.json()).toEqual({ success: true, data: { reachable: false } })
  })

  it('reports what the runtime holds when it is reachable', async () => {
    const res = await buildApp({ reachable: true, models: ['llama-3'] }).request('/models')
    expect(await res.json()).toEqual({ success: true, data: { reachable: true, models: ['llama-3'] } })
  })
})
