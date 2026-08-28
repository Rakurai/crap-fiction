import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildTestApp, idleRoom, UNREACHED_REFERENCE } from '../support/harness.js'
import { MODE_FIXTURE, ROLES_FIXTURE } from '../support/roomFixtures.js'
import { failureCodeSchema } from '../../src/shared/envelope.js'

describe('the theme routes', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function studio() {
    return buildTestApp(dataRoot, {
      modes: [MODE_FIXTURE],
      roles: ROLES_FIXTURE,
      runtimeStatus: undefined,
      room: idleRoom(dataRoot, [MODE_FIXTURE], ROLES_FIXTURE),
      authorContextReference: UNREACHED_REFERENCE,
    }).app
  }

  it('reports a theme never chosen as null, and the chosen one on every read after', async () => {
    const app = studio()

    expect(await (await app.request('/theme')).json()).toEqual({ success: true, data: { theme: null } })

    const put = await app.request('/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    })

    expect(await put.json()).toEqual({ success: true, data: { theme: 'dark' } })
    expect(await (await app.request('/theme')).json()).toEqual({ success: true, data: { theme: 'dark' } })
  })

  it('refuses a theme outside the two the studio declares', async () => {
    const res = await studio().request('/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme: 'sepia' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ success: false, error: { code: failureCodeSchema.enum.INVALID_REQUEST } })
  })
})
