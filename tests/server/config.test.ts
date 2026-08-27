import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/server/config.js'

describe('loadConfig', () => {
  it('boots: the real config.yaml is valid', () => {
    expect(() => loadConfig()).not.toThrow()
  })
})
