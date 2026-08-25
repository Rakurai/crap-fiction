import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/server/env.js'

const validEnv = {
  STUDIO_DATA_ROOT: '/data',
  STUDIO_PORT: '4000',
  STUDIO_MODEL_RUNTIME_URL: 'http://localhost:1234',
  STUDIO_LOG_LEVEL: 'info',
}

/** One wrong value per variable, each wrong in the way that variable can be wrong. */
const WRONG = {
  STUDIO_DATA_ROOT: 'relative/path',
  STUDIO_PORT: 'not-a-number',
  STUDIO_MODEL_RUNTIME_URL: 'not a url',
  STUDIO_LOG_LEVEL: 'verbose',
}

describe('loadEnv', () => {
  it('returns a typed value when every variable is present and valid', () => {
    expect(loadEnv(validEnv)).toEqual({
      dataRoot: '/data',
      port: 4000,
      modelRuntimeUrl: 'http://localhost:1234',
      logLevel: 'info',
    })
  })

  /**
   * Supplying no default and naming what is missing are one claim: an empty environment
   * crashes naming every variable at once, rather than starting on values nobody chose.
   */
  it('supplies no default for any variable, naming every one of them when the environment is empty', () => {
    expect(() => loadEnv({})).toThrowError(
      /STUDIO_DATA_ROOT.*STUDIO_PORT.*STUDIO_MODEL_RUNTIME_URL.*STUDIO_LOG_LEVEL/s,
    )
  })

  it('crashes naming the variable whose value it cannot read, whichever one that is', () => {
    for (const [key, value] of Object.entries(WRONG)) {
      expect(() => loadEnv({ ...validEnv, [key]: value })).toThrowError(new RegExp(key))
    }
  })
})
