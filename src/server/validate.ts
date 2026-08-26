import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import { fail } from '../shared/envelope.js'
import type { Logger } from './logger.js'
import { firstSchemaIssue } from './schemaIssue.js'

export function validateJson<T extends z.ZodType>(schema: T, logger: Logger) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      logger.warn({ code: 'INVALID_REQUEST', method: c.req.method, path: c.req.path }, 'request refused')
      return c.json(fail('INVALID_REQUEST', firstSchemaIssue(result.error).message), 400)
    }
  })
}

export function validateParam<T extends z.ZodType>(schema: T, logger: Logger) {
  return zValidator('param', schema, (result, c) => {
    if (!result.success) {
      logger.warn({ code: 'INVALID_REQUEST', method: c.req.method, path: c.req.path }, 'request refused')
      return c.json(fail('INVALID_REQUEST', firstSchemaIssue(result.error).message), 400)
    }
  })
}
