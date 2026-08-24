import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { failureMessage, requestJson } from '../../src/client/request.js'

const payload = z.object({ title: z.string() })

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

  it('reports the payload once the envelope and the payload both validate', async () => {
    stubFetchOnce({ success: true, data: { title: 'ok' } })

    expect(await requestJson('/x', payload)).toEqual({ outcome: 'value', value: { title: 'ok' } })
  })

  it('reports a declared domain failure as a refusal, carrying the studio\'s own code and sentence', async () => {
    stubFetchOnce({ success: false, error: { code: 'NOPE', message: 'no can do' } })

    expect(await requestJson('/x', payload)).toEqual({ outcome: 'refused', code: 'NOPE', message: 'no can do' })
  })

  it('does not call an unreadable answer a refusal — a refusal is a decision, and this is the absence of one', async () => {
    stubFetchOnce({ success: true, data: { title: 42 } })
    const mismatched = await requestJson('/x', payload)

    stubFetchOnce({ nothing: 'to see here' })
    const unrecognizable = await requestJson('/x', payload)

    expect(mismatched.outcome).toBe('unreachable')
    expect(unrecognizable.outcome).toBe('unreachable')
    expect(failureMessage(mismatched)).toBe('the studio answered with something this client cannot read')
  })

  it('reports a cancelled request as abandoned, and says nothing about it: nothing failed', async () => {
    stubFetchThrowing(new DOMException('aborted', 'AbortError'))

    const result = await requestJson('/x', payload)

    expect(result).toEqual({ outcome: 'abandoned' })
    expect(failureMessage(result)).toBeUndefined()
  })

  it('reports a studio that never answered in the studio\'s terms, not the browser\'s', async () => {
    stubFetchThrowing(new TypeError('Failed to fetch'))

    const result = await requestJson('/x', payload)

    expect(result).toEqual({ outcome: 'unreachable', message: 'the studio did not answer' })
  })

  it('separates a body it cannot read from a request that never completed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('<html>oops</html>'))))

    expect(await requestJson('/x', payload)).toEqual({
      outcome: 'unreachable',
      message: 'the studio answered with something this client cannot read',
    })
  })
})
