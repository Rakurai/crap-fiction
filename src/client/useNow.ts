import { useEffect, useState } from 'react'
import type { Clock } from '../shared/clock.js'

const TICK_MS = 1000

/**
 * The wall clock, re-read once a second for as long as something is counting.
 *
 * This is the one place the interface polls, and what it polls is time itself
 * rather than the studio: CODING_STANDARDS "No polling loops and no waiting for
 * state by timer" forbids asking an operation how it is doing on a schedule, and
 * nothing here asks. Every fact about the round arrives as an event; the only
 * thing that changes between events is how long it has been, and a clock that is
 * not read again does not advance.
 *
 * It stops when `counting` goes false, so a settled conversation costs no timer.
 */
export function useNow(counting: boolean, clock: Clock): number {
  const [now, setNow] = useState(clock)
  useEffect(() => {
    if (!counting) return
    setNow(clock())
    const timer = setInterval(() => setNow(clock()), TICK_MS)
    return () => clearInterval(timer)
  }, [counting, clock])
  return now
}
