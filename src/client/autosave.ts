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
  /** Marks the controller as observed by a mounted surface. */
  activate: () => void
  /**
   * Retires the controller: its debounce is cancelled and a write still in flight reports to nobody.
   * It starts nothing — durably saving what the author last typed belongs to the flush that leaving
   * the piece performs, where the outcome is somebody's to read.
   */
  dispose: () => void
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
  let disposed = false

  function settle(result: RequestResult<null>): AutosaveState {
    if (result.outcome === 'abandoned') return lastState
    const message = failureMessage(result)
    lastState = message === undefined ? { failed: false } : { failed: true, message, atMs: now() }
    if (!disposed) onStateChange(lastState)
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
      return !disposed && dirty ? attempt() : state
    })
    inFlight = promise
    return promise
  }

  function cancelTimer(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  function schedule(): void {
    if (disposed || !dirty || timer !== undefined || inFlight !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      void attempt()
    }, debounceMs)
  }

  return {
    update(text) {
      if (text === latest) return
      latest = text
      dirty = true
      cancelTimer()
      schedule()
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
    activate() {
      disposed = false
      schedule()
    },
    dispose() {
      disposed = true
      cancelTimer()
    },
  }
}
