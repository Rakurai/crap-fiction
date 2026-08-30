import { initialAutosaveState, transitionAutosave, type AutosaveState } from './autosave.js'
import { createSubscribableValue } from './subscribableValue.js'

export type DocumentWrite = (text: string, signal: AbortSignal) => Promise<void>

export type DocumentSettleOutcome = 'settled' | 'failing'

export type DocumentSession = Readonly<{
  getText: () => string
  subscribeText: (onChange: () => void) => () => void
  getFailing: () => boolean
  subscribeFailing: (onChange: () => void) => () => void
  setText: (text: string) => void
  flush: () => void
  flushAndSettle: () => Promise<DocumentSettleOutcome>
  dispose: () => void
}>

export function createDocumentSession(initialText: string, write: DocumentWrite, debounceMs: number): DocumentSession {
  let autosave: AutosaveState = initialAutosaveState(initialText)
  const text = createSubscribableValue(initialText)
  const failing = createSubscribableValue(false)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let currentAbort: AbortController | null = null
  let currentWrite: Promise<void> | null = null
  let disposed = false

  function clearDebounce(): void {
    if (debounceTimer === null) return
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  function armDebounce(): void {
    clearDebounce()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      apply({ type: 'debounceElapsed' })
    }, debounceMs)
  }

  async function runWrite(writeText: string): Promise<void> {
    const controller = new AbortController()
    currentAbort = controller
    let succeeded: boolean
    try {
      await write(writeText, controller.signal)
      succeeded = true
    } catch {
      if (controller.signal.aborted) return
      succeeded = false
    }
    currentAbort = null
    apply(succeeded ? { type: 'writeSucceeded', text: writeText } : { type: 'writeFailed', text: writeText })
    if (!autosave.writeInFlight) currentWrite = null
  }

  function apply(event: Parameters<typeof transitionAutosave>[1]): void {
    const transition = transitionAutosave(autosave, event)
    const failingChanged = transition.state.failing !== autosave.failing
    autosave = transition.state
    if (failingChanged) failing.set(autosave.failing)
    for (const effect of transition.effects) {
      if (effect.type === 'cancelDebounce') clearDebounce()
      else if (effect.type === 'scheduleDebounce') armDebounce()
      else if (effect.type === 'startWrite') currentWrite = runWrite(effect.text)
    }
  }

  return {
    getText: text.get,
    subscribeText: text.subscribe,
    getFailing: failing.get,
    subscribeFailing: failing.subscribe,

    setText: (value) => {
      if (disposed) return
      text.set(value)
      apply({ type: 'textChanged', text: value })
    },

    flush: () => apply({ type: 'flushRequested' }),

    flushAndSettle: async () => {
      apply({ type: 'flushRequested' })
      while (currentWrite !== null) {
        const pending = currentWrite
        await pending
      }
      return autosave.failing ? 'failing' : 'settled'
    },

    dispose: () => {
      disposed = true
      clearDebounce()
      currentAbort?.abort()
    },
  }
}
