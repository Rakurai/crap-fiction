import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaveController, type SaveDocument } from '../../../src/client/autosave.js'
import type { RequestResult } from '../../../src/client/request.js'

const FAILED_AT_MS = new Date(2026, 7, 23, 14, 32).getTime()

const clock = () => FAILED_AT_MS

const WROTE: RequestResult<null> = { outcome: 'value', value: null }
const refused = (message: string): RequestResult<null> => ({ outcome: 'refused', code: 'ARTIFACT_INVALID', message })

function saver() {
  return vi.fn<SaveDocument>()
}

describe('createAutosaveController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes nothing until the text changes, then sends only the latest text once typing pauses', () => {
    const save = saver().mockResolvedValue(WROTE)
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    vi.advanceTimersByTime(5000)
    expect(save).not.toHaveBeenCalled()

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
    expect(save).toHaveBeenCalledTimes(1)

    resolveFirst?.(WROTE)
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenNthCalledWith(2, 'second')
  })

  it('states a failed write, stamped with the moment it came back, and retries only on the next ordinary write', async () => {
    const save = saver()
    save.mockResolvedValueOnce(refused('disk unhappy'))
    save.mockResolvedValueOnce(WROTE)
    const onStateChange = vi.fn()
    let reading = FAILED_AT_MS - 4000
    const controller = createAutosaveController('', save, onStateChange, () => reading, 1000)

    controller.update('first')
    reading = FAILED_AT_MS
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith({ failed: true, message: 'disk unhappy', atMs: FAILED_AT_MS }))

    vi.advanceTimersByTime(60_000)
    expect(save).toHaveBeenCalledTimes(1)

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

    expect(onStateChange).toHaveBeenCalledTimes(1)
  })

  it('flushes the pending write immediately and never resolves optimistically: state changes only once the write settles', async () => {
    const save = saver()
    let resolveSave: ((result: RequestResult<null>) => void) | undefined
    save.mockImplementationOnce(() => new Promise((resolve) => (resolveSave = resolve)))
    const onStateChange = vi.fn()
    const controller = createAutosaveController('', save, onStateChange, clock, 1000)

    controller.update('unsaved')
    const flushed = controller.flush()
    expect(save).toHaveBeenCalledWith('unsaved')
    expect(onStateChange).not.toHaveBeenCalled()

    resolveSave?.(WROTE)
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith({ failed: false }))
    expect(await flushed).toEqual({ failed: false })
  })

  it('resolves the returned promise through a durable failure rather than only reporting it as a side effect', async () => {
    const save = saver().mockResolvedValueOnce(refused('disk unhappy'))
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    controller.update('unsaved')
    const flushed = controller.flush()

    expect(await flushed).toEqual({ failed: true, message: 'disk unhappy', atMs: FAILED_AT_MS })
  })

  it('resolves flush immediately, with no write at all, when nothing is dirty', async () => {
    const save = saver()
    const controller = createAutosaveController('unchanged', save, vi.fn(), clock, 1000)

    expect(await controller.flush()).toEqual({ failed: false })
    expect(save).not.toHaveBeenCalled()
  })

  it('installs a replacement immediately, ahead of any pending debounce, and resolves once that exact write settles', async () => {
    const save = saver().mockResolvedValueOnce(WROTE)
    const controller = createAutosaveController('original', save, vi.fn(), clock, 1000)

    controller.update('a stray keystroke')
    const installed = controller.install('the applied text')

    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('the applied text')
    expect(await installed).toEqual({ failed: false })

    vi.advanceTimersByTime(2000)
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  })

  it('serializes install behind a write already in flight rather than starting a second one', async () => {
    const save = saver()
    let resolveFirst: ((result: RequestResult<null>) => void) | undefined
    save.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    save.mockImplementationOnce(() => Promise.resolve(WROTE))
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    controller.update('first')
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1)

    const installed = controller.install('the applied text')
    expect(save).toHaveBeenCalledTimes(1)

    resolveFirst?.(WROTE)
    expect(await installed).toEqual({ failed: false })
    expect(save).toHaveBeenNthCalledWith(2, 'the applied text')
  })

  it('starts no write of its own when it is retired, and its cancelled debounce never fires', () => {
    const save = saver().mockResolvedValue(WROTE)
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    controller.update('typed and never paused for')
    controller.dispose()

    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)
    expect(save).not.toHaveBeenCalled()
  })

  it('reports nothing to a retired caller, not even the failure of a write already in flight when it retired', async () => {
    let refuse: (result: RequestResult<null>) => void = () => {
      throw new Error('nothing was written')
    }
    const save = saver().mockImplementation(() => new Promise((resolve) => (refuse = resolve)))
    const onStateChange = vi.fn()
    const controller = createAutosaveController('', save, onStateChange, clock, 1000)

    const pending = controller.install('the applied text')
    controller.dispose()
    refuse(refused('EACCES: permission denied'))
    await pending

    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('does not start the dirty write queued behind an in-flight write after retirement', async () => {
    let finish: (result: RequestResult<null>) => void = () => {
      throw new Error('nothing was written')
    }
    const save = saver().mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const controller = createAutosaveController('', save, vi.fn(), clock, 1000)

    const pending = controller.install('first')
    controller.update('second')
    controller.dispose()
    finish(WROTE)
    await pending

    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('first')
  })
})
