import { describe, expect, it } from 'vitest'
import { loadModes } from '../../src/server/modes.js'

describe('loadModes', () => {
  it('parses and validates every mode shipped with the application', () => {
    const modes = loadModes()
    expect(modes.length).toBeGreaterThan(0)
    expect(modes).toContainEqual({ id: 'flash', displayName: 'Flash', description: expect.any(String) })
  })
})
