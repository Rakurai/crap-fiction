import { useEffect, useRef, useState, type RefObject } from 'react'

/** Nothing yields until the pane has actually been measured. */
const UNMEASURED_WIDTH = Number.POSITIVE_INFINITY

export function usePaneWidth<T extends HTMLElement>(): readonly [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(UNMEASURED_WIDTH)

  useEffect(() => {
    const el = ref.current
    if (el === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry !== undefined) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
