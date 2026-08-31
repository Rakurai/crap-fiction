export type AutosaveEvent =
  | Readonly<{ type: 'textChanged'; text: string }>
  | Readonly<{ type: 'debounceElapsed' }>
  | Readonly<{ type: 'flushRequested' }>
  | Readonly<{ type: 'writeSucceeded'; text: string }>
  | Readonly<{ type: 'writeFailed'; text: string }>
  | Readonly<{ type: 'writeCancelled' }>

export type AutosaveEffect =
  | Readonly<{ type: 'scheduleDebounce' }>
  | Readonly<{ type: 'cancelDebounce' }>
  | Readonly<{ type: 'startWrite'; text: string }>

export type AutosaveState = Readonly<{
  latestText: string
  savedText: string
  writeInFlight: boolean
  failing: boolean
}>

export type AutosaveTransition = Readonly<{ state: AutosaveState; effects: readonly AutosaveEffect[] }>

export function initialAutosaveState(initialText: string): AutosaveState {
  return { latestText: initialText, savedText: initialText, writeInFlight: false, failing: false }
}

function attemptStart(state: AutosaveState, cancelDebounce: boolean): AutosaveTransition {
  if (state.writeInFlight) return { state, effects: [] }
  const cancelEffect: readonly AutosaveEffect[] = cancelDebounce ? [{ type: 'cancelDebounce' }] : []
  if (state.latestText === state.savedText) return { state: { ...state, failing: false }, effects: cancelEffect }
  return { state: { ...state, writeInFlight: true }, effects: [...cancelEffect, { type: 'startWrite', text: state.latestText }] }
}

function settle(state: AutosaveState, writtenText: string, failing: boolean): AutosaveTransition {
  const settled: AutosaveState = {
    ...state,
    writeInFlight: false,
    failing,
    savedText: failing ? state.savedText : writtenText,
  }
  if (settled.latestText === writtenText) return { state: settled, effects: [] }
  return { state: { ...settled, writeInFlight: true }, effects: [{ type: 'startWrite', text: settled.latestText }] }
}

export function transitionAutosave(state: AutosaveState, event: AutosaveEvent): AutosaveTransition {
  switch (event.type) {
    case 'textChanged': {
      const next: AutosaveState = { ...state, latestText: event.text }
      if (next.writeInFlight) return { state: next, effects: [] }
      return { state: next, effects: [{ type: 'scheduleDebounce' }] }
    }
    case 'debounceElapsed':
      return attemptStart(state, false)
    case 'flushRequested':
      return attemptStart(state, true)
    case 'writeSucceeded':
      return settle(state, event.text, false)
    case 'writeFailed':
      return settle(state, event.text, true)
    case 'writeCancelled':
      return { state: { ...state, writeInFlight: false }, effects: [] }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
