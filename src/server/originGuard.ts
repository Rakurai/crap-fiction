import type { MiddlewareHandler } from 'hono'
import { fail } from '../shared/envelope.js'
import type { Logger } from './logger.js'

export function originGuard(allowedOrigins: readonly string[], logger: Logger): MiddlewareHandler {
  const allowed = new Set(allowedOrigins)
  return async (c, next) => {
    // A request with no Origin header passes as ordinary same-origin navigation.
    const origin = c.req.header('origin')
    if (origin !== undefined && !allowed.has(origin)) {
      logger.warn({ code: 'ORIGIN_REFUSED', origin, method: c.req.method, path: c.req.path }, 'request refused')
      return c.json(fail('ORIGIN_REFUSED', 'request origin is not served by this application'), 403)
    }
    return next()
  }
}
