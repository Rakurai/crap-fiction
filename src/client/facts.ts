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

import { differenceInCalendarDays, formatDistanceStrict, isSameDay } from 'date-fns'
import type { Clock } from '../shared/clock.js'

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

/**
 * Words that came back from the machine, said in the register rather than folded
 * into a sentence about the author's work — SPEC "Write semantics" wants what a
 * failed write returned on screen, and it is a fact about the machine.
 */
export function machineWords(text: string): string {
  return text.toUpperCase()
}

export function timeOfDay(atMs: number): string {
  return clock.format(new Date(atMs))
}

/**
 * How long a round has been running, from the stamp it opened with — the mockup's
 * `0:14`. Seconds are always two digits so the number does not change width as it
 * counts, which is what keeps a line the author glances at from twitching. Minutes
 * are not rolled up into hours: a call is bounded by its own timeout, so a round
 * that has been running long enough for an hour column to matter is a round whose
 * plain minute count is the more useful thing to have said.
 *
 * The moment is a value rather than a clock, unlike `whenChanged` below: a count
 * that advances is read again every second, so whoever is doing the counting
 * already holds the moment and reading a second clock here would let the two
 * disagree.
 */
export function elapsed(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
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
export function whenChanged(atMs: number, now: Clock): string {
  const at = new Date(atMs)
  const reference = new Date(now())
  if (isSameDay(at, reference)) return 'TODAY'

  const days = Math.abs(differenceInCalendarDays(reference, at))
  if (days < 7) return ago(days, 'DAY')
  if (days < 30) return ago(Math.round(days / 7), 'WEEK')
  return formatDistanceStrict(at, reference, { addSuffix: true, unit: days < 365 ? 'month' : 'year' }).toUpperCase()
}

function ago(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 'S'} AGO`
}
