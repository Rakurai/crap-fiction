import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { failureMessage, type RequestResult } from './request.js'

/**
 * What a surface knows about something it asked the studio for. Five hooks each
 * held their own copy of this union, its effect, its abort controller and its
 * own invented sentence for a failure; this is the one of each.
 */
export type Loaded<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly value: T }

/**
 * Loads one thing when `deps` change, abandoning the request in flight when they
 * change again or the surface goes away. The setter comes back with the state
 * because several callers apply a write's result to what was loaded rather than
 * asking for it again — SPEC "Files" makes a listing a directory scan, so a
 * second scan to learn what the client already knows would be the wasteful half
 * of a round trip.
 *
 * The load function is not a dependency of the effect: it is a closure the caller
 * rebuilds every render, and `deps` names what actually decides the request.
 */
export function useLoaded<T>(
  load: (signal: AbortSignal) => Promise<RequestResult<T>>,
  deps: readonly unknown[],
): readonly [Loaded<T>, Dispatch<SetStateAction<Loaded<T>>>] {
  const [state, setState] = useState<Loaded<T>>({ kind: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    // `requestJson` reports every expected outcome as a value, so there is no
    // rejection to handle here and no `DOMException` for this hook to know by
    // name. An abandoned request has no message, and that is what makes it the
    // one outcome that leaves the state alone: the surface it would have
    // reported to is the one that just went away.
    void load(controller.signal).then((result) => {
      if (result.outcome === 'value') {
        setState({ kind: 'ready', value: result.value })
        return
      }
      const message = failureMessage(result)
      if (message !== undefined) setState({ kind: 'error', message })
    })
    return () => controller.abort()
  }, deps)

  return [state, setState]
}
