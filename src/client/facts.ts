/**
 * UX_DESIGN "Registers": the facts register is where the machine speaks about
 * itself, and it speaks in upper case with a middot between facts. Keeping
 * every string in it composed here is what stops one surface drifting into a
 * sentence — "is what stops an operational number from reading as content, and
 * is why a length the author glances at constantly does not read as a score".
 *
 * The wording is the mockup's: `912 WORDS`, `FLASH · 912 WORDS`,
 * `NOT SAVED · 14:32`.
 */

import { differenceInCalendarDays, formatDistanceToNowStrict, isToday } from 'date-fns'

const words = new Intl.NumberFormat(undefined, { useGrouping: true })

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

/** Joins facts the way the register does, so no surface writes the separator itself. */
export function facts(...parts: readonly string[]): string {
  return parts.join(' · ')
}

export function wordCount(length: number): string {
  return `${words.format(length)} ${length === 1 ? 'WORD' : 'WORDS'}`
}

/** A mode's identifier as the register says it, alongside a length in the mockup's order. */
export function modeName(mode: string): string {
  return mode.toUpperCase()
}

export function timeOfDay(atMs: number): string {
  return clock.format(new Date(atMs))
}

/**
 * When something last changed, in the mockup's wording: `TODAY`, `6 DAYS AGO`,
 * `3 WEEKS AGO`. Relative time is what the author reads a listing for — a
 * machine timestamp answers a question nobody asked of their own stories — and
 * today is said as today rather than as an hour count, because the piece the
 * author was writing this morning is simply the one from today.
 *
 * The rungs are stated here rather than left to the formatter: weeks are not a
 * unit it counts in, so it says `21 DAYS AGO` where the mockup says `3 WEEKS
 * AGO`. Past a month it is the formatter's again, since months and years are
 * units it does count in and a piece untouched that long needs no precision.
 */
export function whenChanged(atMs: number): string {
  const at = new Date(atMs)
  if (isToday(at)) return 'TODAY'

  const days = Math.abs(differenceInCalendarDays(new Date(), at))
  if (days < 7) return ago(days, 'DAY')
  if (days < 30) return ago(Math.round(days / 7), 'WEEK')
  return formatDistanceToNowStrict(at, { addSuffix: true, unit: days < 365 ? 'month' : 'year' }).toUpperCase()
}

function ago(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 'S'} AGO`
}
