import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { failureMessage, requestJson } from '../../src/client/request.js'

const payload = z.object({ title: z.string() })

const UNREADABLE = 'the studio answered with something this client cannot read'

function stubFetchOnce(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), init)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubFetchThrowing(err: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.reject(err)))
}

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reads an answer the studio meant: the payload where both it and the envelope validate, and a refusal carrying the studio's own code and sentence", async () => {
    stubFetchOnce({ success: true, data: { title: 'ok' } })
    expect(await requestJson('/x', payload)).toEqual({ outcome: 'value', value: { title: 'ok' } })

    stubFetchOnce({ success: false, error: { code: 'NOPE', message: 'no can do' } })
    expect(await requestJson('/x', payload)).toEqual({ outcome: 'refused', code: 'NOPE', message: 'no can do' })
  })

  /**
   * One claim over every unreadable answer, whatever it is unreadable about: none of them is
   * a refusal, because a refusal is a decision and this is the absence of one.
   */
  it('does not call an answer it cannot read a refusal, whether the payload, the envelope or the body itself is the part it cannot read', async () => {
    stubFetchOnce({ success: true, data: { title: 42 } })
    const mismatchedPayload = await requestJson('/x', payload)

    stubFetchOnce({ nothing: 'to see here' })
    const unrecognizableEnvelope = await requestJson('/x', payload)

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('<html>oops</html>'))))
    const noJsonAtAll = await requestJson('/x', payload)

    for (const result of [mismatchedPayload, unrecognizableEnvelope, noJsonAtAll]) {
      expect(result).toEqual({ outcome: 'unreachable', message: UNREADABLE })
    }
    expect(failureMessage(mismatchedPayload)).toBe(UNREADABLE)
  })

  it("separates a request the author abandoned, which says nothing because nothing failed, from a studio that never answered, said in the studio's terms rather than the browser's", async () => {
    stubFetchThrowing(new DOMException('aborted', 'AbortError'))
    const abandoned = await requestJson('/x', payload)

    expect(abandoned).toEqual({ outcome: 'abandoned' })
    expect(failureMessage(abandoned)).toBeUndefined()

    stubFetchThrowing(new TypeError('Failed to fetch'))

    expect(await requestJson('/x', payload)).toEqual({ outcome: 'unreachable', message: 'the studio did not answer' })
  })
})
