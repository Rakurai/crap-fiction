export type AutosaveState = { readonly failed: boolean }

export type SaveDraft = (text: string) => Promise<void>

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
export function createAutosaveController(initialText: string, save: SaveDraft, onStateChange: (state: AutosaveState) => void, debounceMs: number = DEBOUNCE_MS): AutosaveController {
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
      .then(() => onStateChange({ failed: false }))
      .catch(() => onStateChange({ failed: true }))
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
