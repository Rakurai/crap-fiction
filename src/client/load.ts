import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { failureMessage, type RequestResult } from './request.js'

export type Loaded<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly value: T }

export function useLoaded<T>(
  load: (signal: AbortSignal) => Promise<RequestResult<T>>,
  deps: readonly unknown[],
): readonly [Loaded<T>, Dispatch<SetStateAction<Loaded<T>>>] {
  const [state, setState] = useState<Loaded<T>>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState({ kind: 'loading' })
    void load(controller.signal).then((result) => {
      if (!active) return
      if (result.outcome === 'value') {
        setState({ kind: 'ready', value: result.value })
        return
      }
      const message = failureMessage(result)
      if (message !== undefined) setState({ kind: 'error', message })
    })
    return () => {
      active = false
      controller.abort()
    }
  }, deps)

  return [state, setState]
}
