import type { MiddlewareHandler } from 'hono'
import { fail } from './envelope.js'

/**
 * Refuses a request carrying an Origin the server does not serve (SPEC
 * "Local exposure") — what stops a page open in another tab from posting
 * to a write route while the author is elsewhere. A request with no
 * Origin header at all is ordinary same-origin navigation and is let
 * through.
 */
export function originGuard(allowedOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header('origin')
    if (origin !== undefined && origin !== allowedOrigin) {
      return c.json(fail('ORIGIN_REFUSED', 'request origin is not served by this application'), 403)
    }
    return next()
  }
}
