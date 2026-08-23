import type { Clock } from '../shared/clock.js'
import { failureMessage, type RequestResult } from './request.js'

export type AutosaveState =
  | { readonly failed: false }
  /** `atMs` is when the write failed: a notice that persists has to say how old it is. */
  | { readonly failed: true; readonly message: string; readonly atMs: number }

/**
 * Writing the draft, in the one convention every client request answers in
 * (`request.ts`). A write that was abandoned is not a failed save — the surface
 * that would have shown the notice is gone — which is why the controller reads
 * the outcome through `failureMessage` rather than testing for success.
 */
export type SaveDraft = (text: string) => Promise<RequestResult<null>>

export type AutosaveController = {
  /** Records the manuscript's current text, debouncing the write it causes. */
  readonly update: (text: string) => void
  /** Sends whatever is unsaved now, without waiting on the result. */
  readonly flush: () => void
}

const DEBOUNCE_MS = 1000

/**
 * SPEC "Write semantics": one draft write is in flight at a time, text
 * produced behind it accumulates and goes out with the next, and a write
 * that fails is retried by the next ordinary write rather than by a timer of
 * its own — retrying failures on a schedule would be a hidden retry loop.
 * React-free so the state machine is exercised directly, without a DOM.
 */
export function createAutosaveController(initialText: string, save: SaveDraft, onStateChange: (state: AutosaveState) => void, now: Clock, debounceMs: number = DEBOUNCE_MS): AutosaveController {
  let latest = initialText
  let dirty = false
  let inFlight = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function attempt(): void {
    if (inFlight || !dirty) return
    const text = latest
    dirty = false
    inFlight = true
    save(text)
      .then((result) => {
        // An abandoned write says nothing either way — it was not refused and it
        // did not land — so whatever the notice says now is left standing.
        if (result.outcome === 'abandoned') return
        const message = failureMessage(result)
        onStateChange(message === undefined ? { failed: false } : { failed: true, message, atMs: now() })
      })
      .finally(() => {
        inFlight = false
        if (dirty) attempt()
      })
  }

  function scheduleAttempt(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      attempt()
    }, debounceMs)
  }

  return {
    update(text) {
      if (text === latest) return
      latest = text
      dirty = true
      scheduleAttempt()
    },
    flush() {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      attempt()
    },
  }
}
