import type { Clock } from '../shared/clock.js'
import { failureMessage, type RequestResult } from './request.js'

export type AutosaveState =
  | { readonly failed: false }
  | { readonly failed: true; readonly message: string; readonly atMs: number }

export type SaveDocument = (text: string) => Promise<RequestResult<null>>

export type AutosaveController = Readonly<{
  /** An ordinary edit: debounced, and never awaited by the caller. */
  update: (text: string) => void
  /** Writes whatever is currently dirty now, or resolves with the current state if nothing is. */
  flush: () => Promise<AutosaveState>
  /** Installs and writes this exact text now, superseding any debounce in flight. */
  install: (text: string) => Promise<AutosaveState>
}>

const DEBOUNCE_MS = 1000

/**
 * The one writer of a surface's document. Every write — an ordinary debounced edit, a flush, or
 * installing an Apply result — goes through `latest`/`dirty` and the single `attempt` chain below,
 * so at most one write is ever in flight and a later one always carries whatever is dirty behind
 * it, the same guarantee for every caller rather than one kept by the debounce path alone.
 */
export function createAutosaveController(
  initialText: string,
  save: SaveDocument,
  onStateChange: (state: AutosaveState) => void,
  now: Clock,
  debounceMs: number = DEBOUNCE_MS,
): AutosaveController {
  let latest = initialText
  let dirty = false
  let lastState: AutosaveState = { failed: false }
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<AutosaveState> | undefined

  function settle(result: RequestResult<null>): AutosaveState {
    if (result.outcome === 'abandoned') return lastState
    const message = failureMessage(result)
    lastState = message === undefined ? { failed: false } : { failed: true, message, atMs: now() }
    onStateChange(lastState)
    return lastState
  }

  function attempt(): Promise<AutosaveState> {
    if (inFlight !== undefined) return inFlight
    if (!dirty) return Promise.resolve(lastState)
    const text = latest
    dirty = false
    const promise = save(text).then((result) => {
      const state = settle(result)
      inFlight = undefined
      return dirty ? attempt() : state
    })
    inFlight = promise
    return promise
  }

  function cancelTimer(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  return {
    update(text) {
      if (text === latest) return
      latest = text
      dirty = true
      cancelTimer()
      timer = setTimeout(() => {
        timer = undefined
        void attempt()
      }, debounceMs)
    },
    flush() {
      cancelTimer()
      return attempt()
    },
    install(text) {
      cancelTimer()
      latest = text
      dirty = true
      return attempt()
    },
  }
}
