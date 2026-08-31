import type { FailureCode } from '../shared/envelope.js'

type RefusalKind = 'invalid' | 'not_found' | 'conflict' | 'internal'

export class RouteFailure extends Error {
  readonly code: FailureCode
  readonly kind: RefusalKind

  constructor(code: FailureCode, kind: RefusalKind, message: string) {
    super(message)
    this.code = code
    this.kind = kind
  }
}

const STATUS_BY_KIND: Readonly<Record<RefusalKind, 400 | 404 | 409 | 500>> = {
  invalid: 400,
  not_found: 404,
  conflict: 409,
  internal: 500,
}

export function statusFor(failure: RouteFailure): 400 | 404 | 409 | 500 {
  return STATUS_BY_KIND[failure.kind]
}
