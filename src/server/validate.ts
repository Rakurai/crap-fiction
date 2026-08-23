import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { fail } from './envelope.js'

/**
 * SPEC "HTTP layer"/CODING_STANDARDS: every JSON response carries the one
 * envelope, so a request body that fails validation is translated into it
 * here, once, rather than by each route that validates a body.
 */
export function validateJson<T extends z.ZodType>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      return c.json(fail('INVALID_REQUEST', issue?.message ?? 'invalid request body'), 400)
    }
  })
}
