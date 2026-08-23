import type { MiddlewareHandler } from 'hono'
import { fail } from '../shared/envelope.js'

/**
 * Refuses a request carrying an Origin the server does not serve (SPEC
 * "Local exposure") — what stops a page open in another tab from posting
 * to a write route while the author is elsewhere. A request with no
 * Origin header at all is ordinary same-origin navigation and is let
 * through. The server binds every interface (SPEC "Local exposure"), and a
 * browser may reach it as either loopback hostname for the same port, so
 * more than one origin can be legitimate.
 */
export function originGuard(allowedOrigins: readonly string[]): MiddlewareHandler {
  const allowed = new Set(allowedOrigins)
  return async (c, next) => {
    const origin = c.req.header('origin')
    if (origin !== undefined && !allowed.has(origin)) {
      return c.json(fail('ORIGIN_REFUSED', 'request origin is not served by this application'), 403)
    }
    return next()
  }
}
