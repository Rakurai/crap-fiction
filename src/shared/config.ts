import { z } from 'zod'
import { firstSchemaIssue } from './schemaIssue.js'

const configSchema = z.object({
  model: z.object({
    retries: z.number().int().nonnegative(),
    timeoutMs: z.number().int().positive(),
    responseMaxTokens: z.number().int().positive(),
    editSetMaxTokens: z.number().int().positive(),
  }),
  applying: z.object({
    rounds: z.number().int().positive(),
  }),
  appliedChange: z.object({
    contextWords: z.number().int().nonnegative(),
    unboundedFraction: z.number().min(0).max(1),
  }),
  autosave: z.object({
    debounceMs: z.number().int().positive(),
  }),
  elapsedTime: z.object({
    tickMs: z.number().int().positive(),
  }),
  callSiteAssignment: z.object({
    savedStandsMs: z.number().int().positive(),
  }),
  mentions: z.object({
    maxMatches: z.number().int().positive(),
  }),
})

export type StudioConfig = Readonly<z.infer<typeof configSchema>>

export function validateConfig(parsed: unknown, fileName: string): StudioConfig {
  const result = configSchema.safeParse(parsed)
  if (!result.success) {
    const { entry, message } = firstSchemaIssue(result.error)
    throw new Error(`${fileName}: ${entry}: ${message}`)
  }
  return Object.freeze(result.data)
}
