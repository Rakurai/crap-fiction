import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildTestApp } from '../../support/harness.js'

describe('/theme', () => {
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
