import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaveController, type SaveDraft } from '../../src/client/autosave.js'
import type { RequestResult } from '../../src/client/request.js'

const FAILED_AT_MS = new Date(2026, 7, 23, 14, 32).getTime()

const clock = () => FAILED_AT_MS

/**
 * A write answers in the one convention every client request answers in, so
 * these are what the adapter hands back rather than a resolved or rejected
 * promise. A failing write is a studio that refused: the server states what went
 * wrong writing draft.md, and that sentence is what the notice quotes.
 */
const WROTE: RequestResult<null> = { outcome: 'value', value: null }
const refused = (message: string): RequestResult<null> => ({ outcome: 'refused', code: 'ARTIFACT_INVALID', message })

/** `vi.fn` typed to the seam, so a test cannot hand the controller something it would not receive. */
function saver() {
  return vi.fn<SaveDraft>()
}

describe('createAutosaveController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not save on construction, only once the text changes', () => {
    const save = saver().mockResolvedValue(WROTE)
    createAutosaveController('draft one', save, vi.fn(), clock, 1000)

    vi.advanceTimersByTime(5000)

    expect(save).not.toHaveBeenCalled()
  })

  it('debounces a write, sending only the latest text once typing pauses', () => {
    const save = saver().mockResolvedValue(WROTE)
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    controller.update('a')
    vi.advanceTimersByTime(500)
    controller.update('ab')
    vi.advanceTimersByTime(500)
    controller.update('abc')
    vi.advanceTimersByTime(1000)

    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('abc')
  })

  it('keeps one write in flight at a time and sends the text produced behind it with the next', async () => {
    const save = saver()
    let resolveFirst: ((result: RequestResult<null>) => void) | undefined
    save.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    save.mockImplementationOnce(() => Promise.resolve(WROTE))
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    controller.update('first')
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1)

    controller.update('second')
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1) // the write in flight is not joined by a second one

    resolveFirst?.(WROTE)
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenNthCalledWith(2, 'second')
  })

  it('states a failed write and retries only on the next ordinary write, not on a timer of its own', async () => {
    const save = saver()
    save.mockResolvedValueOnce(refused('disk unhappy'))
    save.mockResolvedValueOnce(WROTE)
    const onStateChange = vi.fn()
    const controller = createAutosaveController('', save, onStateChange, clock, 1000)

    controller.update('first')
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith({ failed: true, message: 'disk unhappy', atMs: FAILED_AT_MS }))

    vi.advanceTimersByTime(60_000)
    expect(save).toHaveBeenCalledTimes(1) // no hidden retry loop while nothing new was written

    controller.update('second')
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(onStateChange).toHaveBeenLastCalledWith({ failed: false })
  })

  it('leaves the notice standing when a write was abandoned: nothing was refused and nothing landed', async () => {
    const save = saver()
    save.mockResolvedValueOnce(refused('disk unhappy'))
    save.mockResolvedValueOnce({ outcome: 'abandoned' })
    const onStateChange = vi.fn()
    const controller = createAutosaveController('', save, onStateChange, clock, 1000)

    controller.update('first')
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledTimes(1))

    controller.update('second')
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))

    expect(onStateChange).toHaveBeenCalledTimes(1) // the failure is not cleared by a write that never reported
  })

  it('stamps the failure with the moment the write came back, not the moment it was scheduled', async () => {
    const save = saver().mockResolvedValueOnce(refused('disk unhappy'))
    const onStateChange = vi.fn()
    let reading = FAILED_AT_MS
    const controller = createAutosaveController('', save, onStateChange, () => reading, 1000)

    controller.update('first')
    reading = FAILED_AT_MS + 4000
    vi.advanceTimersByTime(1000)

    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ atMs: FAILED_AT_MS + 4000 })))
  })

  it('flushes the pending write immediately, without waiting on it', () => {
    const save = saver().mockResolvedValue(WROTE)
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    controller.update('unsaved')
    controller.flush()

    expect(save).toHaveBeenCalledWith('unsaved')
  })

  it('never resolves optimistically: state only changes once the write settles', async () => {
    const save = saver()
    let resolveSave: ((result: RequestResult<null>) => void) | undefined
    save.mockImplementationOnce(() => new Promise((resolve) => (resolveSave = resolve)))
    const onStateChange = vi.fn()
    const controller = createAutosaveController('', save, onStateChange, clock, 1000)

    controller.update('unsaved')
    controller.flush()
    expect(onStateChange).not.toHaveBeenCalled()

    resolveSave?.(WROTE)
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith({ failed: false }))
  })
})
