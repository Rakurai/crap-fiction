import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaveController } from '../../src/client/autosave.js'

describe('createAutosaveController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not save on construction, only once the text changes', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    createAutosaveController('draft one', save, vi.fn(), 1000)

    vi.advanceTimersByTime(5000)

    expect(save).not.toHaveBeenCalled()
  })

  it('debounces a write, sending only the latest text once typing pauses', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const controller = createAutosaveController('', save, vi.fn(), 1000)

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
    const save = vi.fn()
    let resolveFirst: (() => void) | undefined
    save.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirst = resolve)))
    save.mockImplementationOnce(() => Promise.resolve())
    const controller = createAutosaveController('', save, vi.fn(), 1000)

    controller.update('first')
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1)

    controller.update('second')
    vi.advanceTimersByTime(1000)
    expect(save).toHaveBeenCalledTimes(1) // the write in flight is not joined by a second one

    resolveFirst?.()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenNthCalledWith(2, 'second')
  })

  it('states a failed write and retries only on the next ordinary write, not on a timer of its own', async () => {
    const save = vi.fn()
    save.mockImplementationOnce(() => Promise.reject(new Error('disk unhappy')))
    save.mockImplementationOnce(() => Promise.resolve())
    const onStateChange = vi.fn()
    const controller = createAutosaveController('', save, onStateChange, 1000)

    controller.update('first')
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith({ failed: true, message: 'disk unhappy' }))

    vi.advanceTimersByTime(60_000)
    expect(save).toHaveBeenCalledTimes(1) // no hidden retry loop while nothing new was written

    controller.update('second')
    vi.advanceTimersByTime(1000)
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(onStateChange).toHaveBeenLastCalledWith({ failed: false })
  })

  it('flushes the pending write immediately, without waiting on it', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const controller = createAutosaveController('', save, vi.fn(), 1000)

    controller.update('unsaved')
    controller.flush()

    expect(save).toHaveBeenCalledWith('unsaved')
  })

  it('never resolves optimistically: state only changes once the write settles', async () => {
    const save = vi.fn()
    let resolveSave: (() => void) | undefined
    save.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveSave = resolve)))
    const onStateChange = vi.fn()
    const controller = createAutosaveController('', save, onStateChange, 1000)

    controller.update('unsaved')
    controller.flush()
    expect(onStateChange).not.toHaveBeenCalled()

    resolveSave?.()
    await vi.waitFor(() => expect(onStateChange).toHaveBeenCalledWith({ failed: false }))
  })
})
