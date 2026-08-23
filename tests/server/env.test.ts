import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/server/env.js'

const validEnv = {
  STUDIO_DATA_ROOT: '/data',
  STUDIO_PORT: '4000',
  STUDIO_MODEL_RUNTIME_URL: 'http://localhost:1234',
  STUDIO_LOG_LEVEL: 'info',
}

describe('loadEnv', () => {
  it('returns a typed value when every variable is present and valid', () => {
    const env = loadEnv(validEnv)
    expect(env).toEqual({
      dataRoot: '/data',
      port: 4000,
      modelRuntimeUrl: 'http://localhost:1234',
      logLevel: 'info',
    })
  })

  it.each(Object.keys(validEnv))('crashes naming %s when it is absent', (missingKey) => {
    const withoutOne = { ...validEnv, [missingKey]: undefined }
    expect(() => loadEnv(withoutOne)).toThrowError(new RegExp(missingKey))
  })

  it('crashes naming the variable when STUDIO_PORT is not a valid port', () => {
    expect(() => loadEnv({ ...validEnv, STUDIO_PORT: 'not-a-number' })).toThrowError(/STUDIO_PORT/)
  })

  it('crashes naming the variable when STUDIO_DATA_ROOT is not absolute', () => {
    expect(() => loadEnv({ ...validEnv, STUDIO_DATA_ROOT: 'relative/path' })).toThrowError(
      /STUDIO_DATA_ROOT/,
    )
  })

  it('crashes naming the variable when STUDIO_MODEL_RUNTIME_URL is not a URL', () => {
    expect(() => loadEnv({ ...validEnv, STUDIO_MODEL_RUNTIME_URL: 'not a url' })).toThrowError(
      /STUDIO_MODEL_RUNTIME_URL/,
    )
  })

  it('crashes naming the variable when STUDIO_LOG_LEVEL is not a known level', () => {
    expect(() => loadEnv({ ...validEnv, STUDIO_LOG_LEVEL: 'verbose' })).toThrowError(
      /STUDIO_LOG_LEVEL/,
    )
  })

  it('supplies no default for any variable', () => {
    expect(() => loadEnv({})).toThrowError(
      /STUDIO_DATA_ROOT.*STUDIO_PORT.*STUDIO_MODEL_RUNTIME_URL.*STUDIO_LOG_LEVEL/s,
    )
  })
})
