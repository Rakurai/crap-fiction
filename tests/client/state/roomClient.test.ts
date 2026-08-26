import { afterEach, describe, expect, it, vi } from 'vitest'
import { abandonOperation } from '../../../src/client/roomClient.js'

/** Reacts to the signal it was actually given, the same as a real request would. */
function stubFetchRespectingSignal() {
  const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const signal = init?.signal
    return new Promise((_resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('aborted', 'AbortError'))
        return
      }
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('an abandonable client operation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('propagates the caller’s own cancellation to the underlying request rather than only stopping local observation', async () => {
    const fetchMock = stubFetchRespectingSignal()
    const controller = new AbortController()

    const result = abandonOperation('the-lighthouse', 'draft', 'c1', 'a1', controller.signal)
    controller.abort()

    expect(await result).toEqual({ outcome: 'abandoned' })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }))
  })
})
