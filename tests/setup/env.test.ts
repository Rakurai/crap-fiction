import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/server/env.js'

const DATA_ROOT = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))

afterAll(() => {
  rmSync(DATA_ROOT, { recursive: true, force: true })
})

const VALID_ENV = {
  STUDIO_DATA_ROOT: DATA_ROOT,
  STUDIO_PORT: '4000',
  STUDIO_MODEL_RUNTIME_URL: 'http://localhost:1234',
  STUDIO_LOG_LEVEL: 'info',
  STUDIO_TRACE: 'off',
}

const WRONG = {
  STUDIO_DATA_ROOT: 'relative/path',
  STUDIO_PORT: 'not-a-number',
  STUDIO_MODEL_RUNTIME_URL: 'not a url',
  STUDIO_LOG_LEVEL: 'verbose',
  STUDIO_TRACE: 'true',
}

describe('loadEnv', () => {
  it('returns a typed value when every variable is present and valid', () => {
    expect(loadEnv(VALID_ENV)).toEqual({
      dataRoot: DATA_ROOT,
      port: 4000,
      modelRuntimeUrl: 'http://localhost:1234',
      logLevel: 'info',
      trace: 'off',
    })
  })

  it('supplies no default for any variable, naming every one of them when the environment is empty', () => {
    expect(() => loadEnv({})).toThrowError(
      /STUDIO_DATA_ROOT.*STUDIO_PORT.*STUDIO_MODEL_RUNTIME_URL.*STUDIO_LOG_LEVEL.*STUDIO_TRACE/s,
    )
  })

  it('crashes naming the variable whose value it cannot read, whichever one that is', () => {
    for (const [key, value] of Object.entries(WRONG)) {
      expect(() => loadEnv({ ...VALID_ENV, [key]: value })).toThrowError(new RegExp(key))
    }
  })

  it('crashes on a data root that names no directory, wherever the studio is started from', () => {
    const absent = path.join(DATA_ROOT, 'no-such-directory')
    expect(() => loadEnv({ ...VALID_ENV, STUDIO_DATA_ROOT: absent })).toThrowError(/STUDIO_DATA_ROOT/)
  })
})
