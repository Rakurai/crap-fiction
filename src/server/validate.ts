import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { fail } from '../shared/envelope.js'
import type { Logger } from './logger.js'
import { firstSchemaIssue } from './schemaIssue.js'

/**
 * SPEC "Transport": every JSON response carries the one
 * envelope, so a request body that fails validation is translated into it
 * here, once, rather than by each route that validates a body. The refusal is
 * logged here for the same reason — by its code, and by which route refused,
 * never by the body that was sent.
 */
export function validateJson<T extends z.ZodType>(schema: T, logger: Logger) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      logger.warn({ code: 'INVALID_REQUEST', method: c.req.method, path: c.req.path }, 'request refused')
      return c.json(fail('INVALID_REQUEST', firstSchemaIssue(result.error).message), 400)
    }
  })
}
