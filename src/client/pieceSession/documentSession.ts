import { initialAutosaveState, transitionAutosave, type AutosaveEvent, type AutosaveState } from './autosave.js'
import { createSubscribableValue } from './subscribableValue.js'

export type DocumentWrite = (text: string, signal: AbortSignal) => Promise<void>

type DocumentSettleOutcome = 'settled' | 'failing'

type ReplacementInstaller = (text: string) => void

export type DocumentSession = Readonly<{
  getText: () => string
  subscribeText: (onChange: () => void) => () => void
  getFailing: () => boolean
  subscribeFailing: (onChange: () => void) => () => void
  setText: (text: string) => void
  installReplacement: (text: string) => void
  registerInstaller: (installer: ReplacementInstaller) => () => void
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
  let installer: ReplacementInstaller | null = null

  function clearDebounce(): void {
    if (debounceTimer === null) return
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  function armDebounce(): void {
    clearDebounce()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      dispatch({ type: 'debounceElapsed' })
    }, debounceMs)
  }

  async function runWrite(writeText: string): Promise<void> {
    const controller = new AbortController()
    currentAbort = controller
    let reported: AutosaveEvent
    try {
      await write(writeText, controller.signal)
      reported = { type: 'writeSucceeded', text: writeText }
    } catch {
      reported = controller.signal.aborted ? { type: 'writeCancelled' } : { type: 'writeFailed', text: writeText }
    }
    currentAbort = null
    const followOn = apply(reported)
    if (followOn !== null) await followOn
  }

  function apply(event: AutosaveEvent): Promise<void> | null {
    const transition = transitionAutosave(autosave, event)
    const failingChanged = transition.state.failing !== autosave.failing
    autosave = transition.state
    if (failingChanged) failing.set(autosave.failing)
    let started: Promise<void> | null = null
    for (const effect of transition.effects) {
      if (effect.type === 'cancelDebounce') clearDebounce()
      else if (effect.type === 'scheduleDebounce') armDebounce()
      else if (effect.type === 'startWrite') started = runWrite(effect.text)
    }
    return started
  }

  function dispatch(event: AutosaveEvent): void {
    const started = apply(event)
    if (started === null) return
    currentWrite = started
    void started.then(() => {
      if (currentWrite === started) currentWrite = null
    })
  }

  const setText = (value: string): void => {
    if (disposed) return
    text.set(value)
    dispatch({ type: 'textChanged', text: value })
  }

  return {
    getText: text.get,
    subscribeText: text.subscribe,
    getFailing: failing.get,
    subscribeFailing: failing.subscribe,

    setText,

    installReplacement: (value) => {
      if (disposed) return
      if (installer !== null) installer(value)
      else setText(value)
    },

    registerInstaller: (candidate) => {
      installer = candidate
      return () => {
        if (installer === candidate) installer = null
      }
    },

    flush: () => dispatch({ type: 'flushRequested' }),

    flushAndSettle: async () => {
      dispatch({ type: 'flushRequested' })
      while (currentWrite !== null) await currentWrite
      return autosave.failing ? 'failing' : 'settled'
    },

    dispose: () => {
      disposed = true
      clearDebounce()
      currentAbort?.abort()
    },
  }
}
