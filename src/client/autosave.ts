import type { Clock } from '../shared/clock.js'
import { config } from './config.js'
import { failureMessage, type RequestResult } from './request.js'

export type AutosaveState =
  | { readonly failed: false }
  | { readonly failed: true; readonly message: string; readonly atMs: number }

export type SaveDocument = (text: string) => Promise<RequestResult<null>>

export type AutosaveController = Readonly<{
  update: (text: string) => void
  flush: () => Promise<AutosaveState>
  install: (text: string) => Promise<AutosaveState>
  activate: () => void
  dispose: () => void
}>

export function createAutosaveController(
  initialText: string,
  save: SaveDocument,
  onStateChange: (state: AutosaveState) => void,
  now: Clock,
  debounceMs: number = config.autosave.debounceMs,
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
