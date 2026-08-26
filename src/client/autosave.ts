import type { Clock } from '../shared/clock.js'
import { failureMessage, type RequestResult } from './request.js'

export type AutosaveState =
  | { readonly failed: false }
  | { readonly failed: true; readonly message: string; readonly atMs: number }

export type SaveDocument = (text: string) => Promise<RequestResult<null>>

export type AutosaveController = {
  readonly update: (text: string) => void
  readonly flush: () => void
}

const DEBOUNCE_MS = 1000

export function createAutosaveController(initialText: string, save: SaveDocument, onStateChange: (state: AutosaveState) => void, now: Clock, debounceMs: number = DEBOUNCE_MS): AutosaveController {
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
