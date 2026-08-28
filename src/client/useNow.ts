import { useEffect, useState } from 'react'
import type { Clock } from '../shared/clock.js'
import { config } from './config.js'

export function useNow(counting: boolean, clock: Clock): number {
  const [now, setNow] = useState(clock)
  useEffect(() => {
    if (!counting) return
    setNow(clock())
    const timer = setInterval(() => setNow(clock()), config.elapsedTime.tickMs)
    return () => clearInterval(timer)
  }, [counting, clock])
  return now
}
