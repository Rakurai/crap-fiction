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

  /**
   * Which call sites there are, what each carries and where an assignment shows as
   * `null` are `callSites`'s own, asserted at `model/callSites.test.ts`. What the
   * route owes is that the composed view reaches the author in the envelope's data
   * field, whole and in the order the module built it.
   */
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

  /**
   * That an unanswering runtime reads as `{ reachable: false }` rather than as a
   * thrown error is the adapter's, asserted at `model/lmStudioAdapter.test.ts`. The
   * route's own claim is the one this asserts: a runtime that cannot be reached is
   * still an answer, so it travels the envelope's success channel with a 200 and is
   * never turned into a refusal the author would read as their own mistake.
   */
  it('reports an unreachable runtime on the success channel rather than as a refusal', async () => {
    const res = await buildApp({ reachable: false }).request('/models')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { reachable: false } })
  })
})
