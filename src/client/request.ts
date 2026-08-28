import type { z } from 'zod'
import { responseEnvelopeSchema, type FailureCode } from '../shared/envelope.js'

export type RequestResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'refused'; readonly code: FailureCode; readonly message: string }
  | { readonly outcome: 'unreachable'; readonly message: string }

const UNREACHABLE = 'the studio did not answer'

const UNREADABLE = 'the studio answered with something this client cannot read'

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export async function requestJson<T>(
  url: string,
  payload: z.ZodType<T>,
  init: RequestInit = {},
): Promise<RequestResult<T>> {
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

  const parsed = responseEnvelopeSchema(payload).safeParse(body)
  if (!parsed.success) return { outcome: 'unreachable', message: UNREADABLE }
  if (!parsed.data.success) {
    return { outcome: 'refused', code: parsed.data.error.code, message: parsed.data.error.message }
  }
  return { outcome: 'value', value: parsed.data.data }
}

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
