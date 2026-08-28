import { describe, expect, it } from 'vitest'
import { elapsed, facts, modeName, timeOfDay, whenChanged, wordCount } from '../../src/client/facts.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 7, 23, 20, 0).getTime()
const clock = () => NOW

describe('the facts register', () => {
  it('says a length in the register the studio speaks in, singular where there is one word', () => {
    expect(wordCount(1140)).toBe('1,140 WORDS')
    expect(wordCount(1)).toBe('1 WORD')
  })

  it('joins facts with the separator the register uses, in the order given, each in upper case', () => {
    expect(facts(modeName('flash'), wordCount(912))).toBe('FLASH · 912 WORDS')
  })

  it('says the calendar day it is handed as today, whatever hour of it, and anything earlier by its distance', () => {
    expect(whenChanged(NOW, clock)).toBe('TODAY')
    expect(whenChanged(new Date(2026, 7, 23, 6, 0).getTime(), clock)).toBe('TODAY')

    expect(whenChanged(NOW - 6 * DAY_MS, clock)).toBe('6 DAYS AGO')
    expect(whenChanged(NOW - 30 * DAY_MS, clock)).toBe('1 MONTH AGO')
  })

  it('counts a wait in minutes and two-digit seconds so it does not change width as it runs, and a wait not begun as none', () => {
    expect(elapsed(NOW - 14_000, NOW)).toBe('0:14')
    expect(elapsed(NOW - 67_000, NOW)).toBe('1:07')
    expect(elapsed(NOW + 5_000, NOW)).toBe('0:00')
  })

  it('says a time of day on a 24-hour clock, as the notice stamps it', () => {
    expect(timeOfDay(new Date(2026, 7, 23, 14, 32).getTime())).toBe('14:32')
  })
})
