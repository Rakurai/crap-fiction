import { describe, expect, it } from 'vitest'
import { initialAutosaveState, transitionAutosave, type AutosaveState } from '../../src/client/pieceSession/autosave.js'

const INITIAL_TEXT = 'the first line'

function apply(state: AutosaveState, events: readonly Parameters<typeof transitionAutosave>[1][]): AutosaveState {
  return events.reduce((current, event) => transitionAutosave(current, event).state, state)
}

describe('scheduling a write from typing', () => {
  it('asks for a debounce rather than writing immediately when text changes', () => {
    const state = initialAutosaveState(INITIAL_TEXT)
    const { state: next, effects } = transitionAutosave(state, { type: 'textChanged', text: 'the first line, revised' })
    expect(effects).toEqual([{ type: 'scheduleDebounce' }])
    expect(next.writeInFlight).toBe(false)
  })

  it('starts a write once the debounce elapses on text that differs from what was last saved', () => {
    const typed = apply(initialAutosaveState(INITIAL_TEXT), [{ type: 'textChanged', text: 'revised' }])
    const { state, effects } = transitionAutosave(typed, { type: 'debounceElapsed' })
    expect(effects).toEqual([{ type: 'startWrite', text: 'revised' }])
    expect(state.writeInFlight).toBe(true)
  })

  it('starts nothing when the debounce elapses on text that already matches what was saved', () => {
    const { effects } = transitionAutosave(initialAutosaveState(INITIAL_TEXT), { type: 'debounceElapsed' })
    expect(effects).toEqual([])
  })
})

describe('one write in flight at a time', () => {
  it('keeps a second debounce from starting a concurrent write', () => {
    const inFlight = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised once' },
      { type: 'debounceElapsed' },
    ])
    expect(inFlight.writeInFlight).toBe(true)

    const { state, effects } = transitionAutosave(inFlight, { type: 'debounceElapsed' })
    expect(effects).toEqual([])
    expect(state.writeInFlight).toBe(true)
  })

  it('accumulates text produced while a write is in flight and sends it with the next write once the first settles', () => {
    const inFlight = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised once' },
      { type: 'debounceElapsed' },
      { type: 'textChanged', text: 'revised twice' },
    ])
    expect(inFlight.latestText).toBe('revised twice')

    const { state, effects } = transitionAutosave(inFlight, { type: 'writeSucceeded', text: 'revised once' })
    expect(effects).toEqual([{ type: 'startWrite', text: 'revised twice' }])
    expect(state.writeInFlight).toBe(true)
    expect(state.savedText).toBe('revised once')
  })

  it('starts no further write once a settled write already covers the latest text', () => {
    const inFlight = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised once' },
      { type: 'debounceElapsed' },
    ])
    const { state, effects } = transitionAutosave(inFlight, { type: 'writeSucceeded', text: 'revised once' })
    expect(effects).toEqual([])
    expect(state.writeInFlight).toBe(false)
    expect(state.savedText).toBe('revised once')
  })
})

describe('a failed write', () => {
  it('is stated as failing and leaves the unwritten text as the latest text', () => {
    const inFlight = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised' },
      { type: 'debounceElapsed' },
    ])
    const { state, effects } = transitionAutosave(inFlight, { type: 'writeFailed', text: 'revised' })
    expect(state.failing).toBe(true)
    expect(state.savedText).toBe(INITIAL_TEXT)
    expect(state.latestText).toBe('revised')
    expect(effects).toEqual([])
  })

  it('schedules no retry of its own, but the next ordinary write — a debounce elapsing or an explicit flush — retries the still-unsaved text', () => {
    const failed = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised' },
      { type: 'debounceElapsed' },
      { type: 'writeFailed', text: 'revised' },
    ])
    expect(failed.failing).toBe(true)
    expect(failed.writeInFlight).toBe(false)

    const viaDebounce = transitionAutosave(failed, { type: 'debounceElapsed' })
    expect(viaDebounce.effects).toEqual([{ type: 'startWrite', text: 'revised' }])

    const viaFlush = transitionAutosave(failed, { type: 'flushRequested' })
    expect(viaFlush.effects).toEqual([{ type: 'cancelDebounce' }, { type: 'startWrite', text: 'revised' }])
  })

  it('clears once a later write of the same or newer text succeeds', () => {
    const failed = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised' },
      { type: 'debounceElapsed' },
      { type: 'writeFailed', text: 'revised' },
      { type: 'flushRequested' },
    ])
    expect(failed.writeInFlight).toBe(true)

    const { state } = transitionAutosave(failed, { type: 'writeSucceeded', text: 'revised' })
    expect(state.failing).toBe(false)
    expect(state.savedText).toBe('revised')
  })

  it('keeps text produced during the failing write in flight and sends it once that write settles', () => {
    const inFlight = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised once' },
      { type: 'debounceElapsed' },
      { type: 'textChanged', text: 'revised twice' },
    ])
    const { state, effects } = transitionAutosave(inFlight, { type: 'writeFailed', text: 'revised once' })
    expect(state.failing).toBe(true)
    expect(effects).toEqual([{ type: 'startWrite', text: 'revised twice' }])
  })
})

describe('flushing an idle document', () => {
  it('does nothing where the latest text already matches what was saved', () => {
    const { state, effects } = transitionAutosave(initialAutosaveState(INITIAL_TEXT), { type: 'flushRequested' })
    expect(effects).toEqual([{ type: 'cancelDebounce' }])
    expect(state.writeInFlight).toBe(false)
  })

  it('leaves an in-flight write alone rather than starting a second one', () => {
    const inFlight = apply(initialAutosaveState(INITIAL_TEXT), [
      { type: 'textChanged', text: 'revised' },
      { type: 'debounceElapsed' },
    ])
    const { state, effects } = transitionAutosave(inFlight, { type: 'flushRequested' })
    expect(effects).toEqual([])
    expect(state.writeInFlight).toBe(true)
  })

  it('starts a write immediately for text still waiting on its debounce', () => {
    const pending = apply(initialAutosaveState(INITIAL_TEXT), [{ type: 'textChanged', text: 'revised' }])
    const { state, effects } = transitionAutosave(pending, { type: 'flushRequested' })
    expect(effects).toEqual([{ type: 'cancelDebounce' }, { type: 'startWrite', text: 'revised' }])
    expect(state.writeInFlight).toBe(true)
  })
})
