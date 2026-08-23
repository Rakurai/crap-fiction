import { describe, expect, it } from 'vitest'
import { facts, modeName, timeOfDay, whenChanged, wordCount } from '../../src/client/facts.js'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 7, 23, 20, 0).getTime()
const clock = () => NOW

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

  it('says today as today rather than as an hour count, on the clock handed to it', () => {
    expect(whenChanged(NOW, clock)).toBe('TODAY')
  })

  it('says the same calendar day as today regardless of how many hours separate the two moments', () => {
    const earlierToday = new Date(2026, 7, 23, 6, 0).getTime()
    expect(whenChanged(earlierToday, clock)).toBe('TODAY')
  })

  it('says the day before the week rung turns as days', () => {
    expect(whenChanged(NOW - 6 * DAY_MS, clock)).toBe('6 DAYS AGO')
  })

  it('says the day the week rung turns as weeks', () => {
    expect(whenChanged(NOW - 7 * DAY_MS, clock)).toBe('1 WEEK AGO')
  })

  it('says the day before the month rung turns as weeks', () => {
    expect(whenChanged(NOW - 29 * DAY_MS, clock)).toBe('4 WEEKS AGO')
  })

  it('says the day the month rung turns as a formatted month', () => {
    expect(whenChanged(NOW - 30 * DAY_MS, clock)).toBe('1 MONTH AGO')
  })

  it('says a time of day on a 24-hour clock, as the notice stamps it', () => {
    const at = new Date(2026, 7, 23, 14, 32).getTime()
    expect(timeOfDay(at)).toBe('14:32')
  })
})
