import { z } from 'zod'
import { responseEnvelopeSchema, type FailureCode } from '../../shared/envelope.js'

export type RequestFailureReason = Readonly<{ kind: 'refused'; code: FailureCode }> | Readonly<{ kind: 'unreachable' }>

export class RequestFailure extends Error {
  readonly reason: RequestFailureReason

  constructor(message: string, reason: RequestFailureReason) {
    super(message)
    this.name = 'RequestFailure'
    this.reason = reason
  }
}

const UNREACHABLE_MESSAGE = 'the studio could not be reached'

function unreachable(): never {
  throw new RequestFailure(UNREACHABLE_MESSAGE, { kind: 'unreachable' })
}

export function unwrapEnvelope<T>(body: unknown, schema: z.ZodType<T>): T {
  const parsed = responseEnvelopeSchema(schema).safeParse(body)
  if (!parsed.success) return unreachable()
  const envelope = parsed.data
  if (!envelope.success) throw new RequestFailure(envelope.error.message, { kind: 'refused', code: envelope.error.code })
  return envelope.data
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return unreachable()
  }
}

async function send<T>(path: string, schema: z.ZodType<T>, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    return unreachable()
  }
  return unwrapEnvelope(await readBody(response), schema)
}

export function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  return send(path, schema, { signal: signal ?? null })
}

const JSON_HEADERS = { 'content-type': 'application/json' } as const

function withBody(method: string, body: unknown, signal: AbortSignal | undefined): RequestInit {
  return { method, headers: JSON_HEADERS, body: JSON.stringify(body), signal: signal ?? null }
}

export function post<T>(path: string, schema: z.ZodType<T>, body: unknown, signal?: AbortSignal): Promise<T> {
  return send(path, schema, withBody('POST', body, signal))
}

export function put<T>(path: string, schema: z.ZodType<T>, body: unknown, signal?: AbortSignal): Promise<T> {
  return send(path, schema, withBody('PUT', body, signal))
}

export function patch<T>(path: string, schema: z.ZodType<T>, body: unknown, signal?: AbortSignal): Promise<T> {
  return send(path, schema, withBody('PATCH', body, signal))
}

export function del<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  return send(path, schema, { method: 'DELETE', signal: signal ?? null })
}
