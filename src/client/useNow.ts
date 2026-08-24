import { useEffect, useState } from 'react'
import type { Clock } from '../shared/clock.js'

const TICK_MS = 1000

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
