import type { z } from 'zod'
import { apiResponseSchema } from '../server/envelope.js'

export class RequestFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestFailure'
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * The one seam every client request crosses (CODING_STANDARDS "HTTP layer":
 * unwrap the envelope once, in the client adapter that owns the request).
 * Validates the envelope and its payload before anything reads the body, so
 * no adapter casts a foreign response to the shape it hopes for.
 */
export async function requestJson<T>(url: string, payload: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init)
  const body: unknown = await res.json()
  const parsed = apiResponseSchema(payload).safeParse(body)
  if (!parsed.success) {
    throw new RequestFailure('malformed response from server')
  }
  if (!parsed.data.success) {
    throw new RequestFailure(parsed.data.error.message)
  }
  return parsed.data.data
}
