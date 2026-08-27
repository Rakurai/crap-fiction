import { differenceInCalendarDays, formatDistanceStrict, isSameDay } from 'date-fns'
import type { Clock } from '../shared/clock.js'

const words = new Intl.NumberFormat(undefined, { useGrouping: true })

const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })

export function facts(...parts: readonly string[]): string {
  return parts.join(' · ')
}

export function wordCount(length: number): string {
  return `${words.format(length)} ${length === 1 ? 'WORD' : 'WORDS'}`
}

export function modeName(mode: string): string {
  return mode.toUpperCase()
}

export function machineWords(text: string): string {
  return text.toUpperCase()
}

export function timeOfDay(atMs: number): string {
  return clock.format(new Date(atMs))
}

export function elapsed(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function whenChanged(atMs: number, now: Clock): string {
  return isSameDay(new Date(atMs), new Date(now())) ? 'TODAY' : coarseDistance(atMs, now)
}

export function messageWhen(atMs: number, now: Clock): string {
  return isSameDay(new Date(atMs), new Date(now())) ? timeOfDay(atMs) : coarseDistance(atMs, now)
}

function coarseDistance(atMs: number, now: Clock): string {
  const at = new Date(atMs)
  const reference = new Date(now())
  const days = Math.abs(differenceInCalendarDays(reference, at))
  if (days < 7) return ago(days, 'DAY')
  if (days < 30) return ago(Math.round(days / 7), 'WEEK')
  return formatDistanceStrict(at, reference, { addSuffix: true, unit: days < 365 ? 'month' : 'year' }).toUpperCase()
}

function ago(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 'S'} AGO`
}
