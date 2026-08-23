import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { isAbortError, RequestFailure, requestJson } from '../../src/client/request.js'

function stubFetchOnce(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), init)))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the payload once the envelope and the payload both validate', async () => {
    stubFetchOnce({ success: true, data: { title: 'ok' } })

    const result = await requestJson('/x', z.object({ title: z.string() }))

    expect(result).toEqual({ title: 'ok' })
  })

  it('throws RequestFailure carrying the server message on a declared domain failure', async () => {
    stubFetchOnce({ success: false, error: { code: 'NOPE', message: 'no can do' } })

    await expect(requestJson('/x', z.object({ title: z.string() }))).rejects.toThrow(RequestFailure)
    await expect(requestJson('/x', z.object({ title: z.string() }))).rejects.toThrow('no can do')
  })

  it('throws RequestFailure, not a raw schema error, when the payload does not match', async () => {
    stubFetchOnce({ success: true, data: { title: 42 } })

    await expect(requestJson('/x', z.object({ title: z.string() }))).rejects.toThrow(RequestFailure)
  })

  it('throws RequestFailure when the envelope shape itself is unrecognizable', async () => {
    stubFetchOnce({ nothing: 'to see here' })

    await expect(requestJson('/x', z.object({ title: z.string() }))).rejects.toThrow(RequestFailure)
  })
})

describe('isAbortError', () => {
  it('recognizes an aborted fetch and nothing else', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true)
    expect(isAbortError(new Error('network down'))).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })
})
