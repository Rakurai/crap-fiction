import { describe, expect, it } from 'vitest'
import { validateConfig } from '../../src/shared/config.js'

const fixture = {
  model: { retries: 4, timeoutMs: 9000, responseMaxTokens: 300, editSetMaxTokens: 4000 },
  applying: { rounds: 3 },
  appliedChange: { contextWords: 3, unboundedFraction: 0.7 },
  autosave: { debounceMs: 500 },
  elapsedTime: { tickMs: 250 },
  callSiteAssignment: { savedStandsMs: 1200 },
  mentions: { maxMatches: 5 },
}

describe('validateConfig', () => {
  it('returns every declared value when the input is valid', () => {
    expect(validateConfig(fixture, 'fixture.yaml')).toEqual(fixture)
  })

  it('fails naming the file and the key for a missing value', () => {
    const { retries, ...modelRest } = fixture.model
    expect(() => validateConfig({ ...fixture, model: modelRest }, 'fixture.yaml')).toThrowError(/fixture\.yaml.*model\.retries/s)
  })

  it('fails naming the file and the key for a wrong-kind value', () => {
    expect(() => validateConfig({ ...fixture, autosave: { debounceMs: 'soon' } }, 'fixture.yaml')).toThrowError(
      /fixture\.yaml.*autosave\.debounceMs/s,
    )
  })

  it('supplies no default, naming a whole absent section', () => {
    const { autosave, ...rest } = fixture
    expect(() => validateConfig(rest, 'fixture.yaml')).toThrowError(/fixture\.yaml.*autosave/s)
  })
})
