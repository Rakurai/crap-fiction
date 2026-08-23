import { describe, expect, it } from 'vitest'
import { facts, modeName, timeOfDay, whenChanged, wordCount } from '../../src/client/facts.js'

const DAY_MS = 24 * 60 * 60 * 1000

describe('the facts register', () => {
  it('says a length in upper case, with a thousands separator', () => {
    expect(wordCount(1140)).toBe('1,140 WORDS')
  })

  it('says one word as one word rather than as a plural', () => {
    expect(wordCount(1)).toBe('1 WORD')
  })

  it('says a mode in upper case', () => {
    expect(modeName('flash')).toBe('FLASH')
  })

  it('joins facts with the separator the register uses, in the order given', () => {
    expect(facts(modeName('flash'), wordCount(912))).toBe('FLASH · 912 WORDS')
  })

  it('says today as today rather than as an hour count', () => {
    expect(whenChanged(Date.now())).toBe('TODAY')
  })

  it('says an older moment as relative time, in upper case', () => {
    expect(whenChanged(Date.now() - 6 * DAY_MS)).toBe('6 DAYS AGO')
    expect(whenChanged(Date.now() - 21 * DAY_MS)).toBe('3 WEEKS AGO')
  })

  it('says a time of day on a 24-hour clock, as the notice stamps it', () => {
    const at = new Date(2026, 7, 23, 14, 32).getTime()
    expect(timeOfDay(at)).toBe('14:32')
  })
})
