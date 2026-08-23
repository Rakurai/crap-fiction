import type { z } from 'zod'
import { apiResponseSchema } from '../shared/envelope.js'

/**
 * What asking the studio for something can come to. Four outcomes rather than a
 * value and an exception, because three of these are expected: a request the
 * author cancelled by navigating, a studio that refused, and a studio that could
 * not be reached are all ordinary in a single-user application whose server is
 * another process on the same machine. Nothing here throws for any of them
 * (CODING_STANDARDS "Errors and failures": an expected outcome is a return value).
 *
 * The shape is the model seam's (`CallResult`) deliberately: the codebase has
 * already chosen a vocabulary for "this may not have produced a value, and here
 * is which way it did not", and one client convention that reads like the server's
 * own is worth more than a second invention.
 *
 * `refused` and `unreachable` are separate outcomes rather than one carrying an
 * optional code, because they are different facts and a surface may want to draw
 * them differently: a refusal is something the studio decided and stated in its
 * own taxonomy, and unreachable is the absence of any such statement.
 */
export type RequestResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'refused'; readonly code: string; readonly message: string }
  | { readonly outcome: 'unreachable'; readonly message: string }

/**
 * The one string the client composes about a failure. Every other message a
 * surface shows comes from the studio, which is the half of the envelope that is
 * text safe to show; this one exists because a studio that cannot be reached
 * said nothing to quote. One such sentence in one place is the point — five
 * fallbacks scattered through five hooks were the defect.
 */
const UNREACHABLE = 'the studio did not answer'

/** An unreadable answer is not a refusal: a refusal is a decision, and this is the absence of one. */
const UNREADABLE = 'the studio answered with something this client cannot read'

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * The one seam every client request crosses (CODING_STANDARDS "HTTP layer":
 * unwrap the envelope once, in the client adapter that owns the request).
 * Validates the envelope and its payload before anything reads the body, so
 * no adapter casts a foreign response to the shape it hopes for.
 *
 * Cancellation is recognized here and nowhere above: an aborted fetch is the
 * transport's own fact, and every caller that had to know `DOMException` by name
 * to tell a cancelled request from a broken one was reaching through this seam
 * rather than across it.
 */
export async function requestJson<T>(
  url: string,
  payload: z.ZodType<T>,
  init: RequestInit = {},
): Promise<RequestResult<T>> {
  // The request and its body are read separately because the two fail
  // differently: a request that never completed is a studio that said nothing,
  // and a body that is not JSON is a studio that said something this client
  // cannot read. Whatever `fetch` threw says "Failed to fetch" or worse, which is
  // a browser's sentence about a socket rather than anything an author asked for,
  // so the composed sentence is what is reported and the thrown detail is not.
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    if (isAbortError(err)) return { outcome: 'abandoned' }
    return { outcome: 'unreachable', message: UNREACHABLE }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch (err) {
    if (isAbortError(err)) return { outcome: 'abandoned' }
    return { outcome: 'unreachable', message: UNREADABLE }
  }

  const parsed = apiResponseSchema(payload).safeParse(body)
  if (!parsed.success) return { outcome: 'unreachable', message: UNREADABLE }
  if (!parsed.data.success) {
    return { outcome: 'refused', code: parsed.data.error.code, message: parsed.data.error.message }
  }
  return { outcome: 'value', value: parsed.data.data }
}

/**
 * The message a surface shows for an outcome that produced no value. A cancelled
 * request has none — nothing failed, the author simply went elsewhere — which is
 * why this is `undefined` for `abandoned` and why no caller has to invent one.
 */
export function failureMessage<T>(result: RequestResult<T>): string | undefined {
  switch (result.outcome) {
    case 'value':
    case 'abandoned':
      return undefined
    case 'refused':
    case 'unreachable':
      return result.message
  }
}
