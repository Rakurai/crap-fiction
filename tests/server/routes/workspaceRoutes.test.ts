import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildTestApp } from '../../support/harness.js'

describe('/workspace', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function buildApp() {
    return buildTestApp(dataRoot).app
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

  it('refuses a workspace outside the data root as a 400 naming the reason', async () => {
    const putRes = await buildApp().request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: '/etc/passwd' }),
    })

    expect(putRes.status).toBe(400)
    expect(await putRes.json()).toMatchObject({ success: false, error: { code: 'WORKSPACE_OUTSIDE_ROOT' } })
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
