import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { RuntimeStatus } from '../../../src/shared/runtimeStatus.js'
import { buildTestApp } from '../../support/harness.js'

const CALL_SITE_ROLES: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'attends to the turn' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'the generalist' },
]

describe('call sites and models', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function buildApp(runtimeStatus?: RuntimeStatus) {
    return buildTestApp(dataRoot, { roles: CALL_SITE_ROLES, runtimeStatus }).app
  }

  it('carries the composed call-site view in the envelope', async () => {
    const res = await buildApp().request('/call-sites')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.map((site: { site: string }) => site.site)).toEqual(['shape', 'story-editor', 'apply', 'capture'])
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

  it('replaces an assignment with a different model rather than keeping the first', async () => {
    const app = buildApp()
    const assign = (model: string) =>
      app.request('/call-sites/shape/assignment', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model }),
      })

    await assign('llama-3')
    const second = await assign('qwen3-30b')
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ success: true, data: { site: 'shape', assignment: 'qwen3-30b' } })

    const body = await (await app.request('/call-sites')).json()
    expect(body.data.find((site: { site: string }) => site.site === 'shape').assignment).toBe('qwen3-30b')
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

  it('reports an unreachable runtime on the success channel rather than as a refusal', async () => {
    const res = await buildApp({ reachable: false }).request('/models')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { reachable: false } })
  })
})
