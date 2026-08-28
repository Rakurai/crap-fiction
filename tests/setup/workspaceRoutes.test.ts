import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { idleStudio } from '../support/harness.js'
import { MODE_FIXTURE } from '../support/roomFixtures.js'
import { failureCodeSchema } from '../../src/shared/envelope.js'

describe('the workspace routes', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function studio() {
    return idleStudio(dataRoot, [MODE_FIXTURE], undefined).app
  }

  it('reports an unconfigured workspace as null, and the resolved directory on every read after', async () => {
    const app = studio()

    expect(await (await app.request('/workspace')).json()).toEqual({ success: true, data: { workspace: null } })

    const put = await app.request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: 'my-writing' }),
    })

    expect(await put.json()).toEqual({ success: true, data: { workspace: path.join(dataRoot, 'my-writing') } })
    expect(await (await app.request('/workspace')).json()).toEqual({ success: true, data: { workspace: path.join(dataRoot, 'my-writing') } })
  })

  it('states a workspace outside the data root in the envelope', async () => {
    const res = await studio().request('/workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: '/etc/passwd' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.WORKSPACE_OUTSIDE_ROOT } })
  })
})
