import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import type { RuntimeStatus } from '../../../src/shared/runtimeStatus.js'
import { buildTestApp } from '../../support/harness.js'

/**
 * Which assignment a write reaches, and that it leaves the others alone, belongs to
 * `model/assignments.test.ts`. These tests own the routes: the composed view, and the
 * two answers a runtime the author cannot reach arrives as.
 */

const MODE: ModeDescriptor = { id: 'flash', name: 'Flash', cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }] }

const ROLES: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'attends to the turn', persona: 'reasons about attends to the turn', eligibility: 'cast' },
  {
    id: 'story-editor',
    handle: 'editor',
    displayName: 'Story Editor',
    description: 'the generalist',
    persona: 'reasons about the generalist',
    eligibility: 'generalist',
  },
]

describe('the call-site and model routes', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function studio(runtimeStatus?: RuntimeStatus) {
    return buildTestApp(dataRoot, { mode: MODE, roles: ROLES, runtimeStatus }).app
  }

  it('carries every call site the roles compose to, in the order the studio names them', async () => {
    const res = await studio().request('/call-sites')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((site: { site: string }) => site.site)).toEqual(['shape', 'story-editor', 'apply', 'capture'])
  })

  it('reaches the assignment a write names, and reports it on the composed view after', async () => {
    const app = studio()

    const put = await app.request('/call-sites/shape/assignment', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3' }),
    })
    expect(await put.json()).toEqual({ success: true, data: { site: 'shape', assignment: 'llama-3' } })

    const body = await (await app.request('/call-sites')).json()
    expect(body.data.find((site: { site: string }) => site.site === 'shape').assignment).toBe('llama-3')
  })

  it('states a call site that does not exist in the envelope', async () => {
    const res = await studio().request('/call-sites/no-such-site/assignment', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3' }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'CALL_SITE_NOT_FOUND' } })
  })

  it('reports an unreachable runtime on the success channel rather than as a refusal', async () => {
    const res = await studio({ reachable: false }).request('/models')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { reachable: false } })
  })
})
