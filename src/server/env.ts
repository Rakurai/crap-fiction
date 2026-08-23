import path from 'node:path'
import { z } from 'zod'

const VARIABLES = [
  'STUDIO_DATA_ROOT',
  'STUDIO_PORT',
  'STUDIO_MODEL_RUNTIME_URL',
  'STUDIO_LOG_LEVEL',
] as const

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])

const shapeSchema = z.object({
  STUDIO_DATA_ROOT: z
    .string()
    .min(1)
    .refine(path.isAbsolute, 'must be an absolute path'),
  STUDIO_PORT: z
    .string()
    .regex(/^\d+$/, 'must be a positive integer')
    .transform(Number)
    .refine((port) => port >= 1 && port <= 65535, 'must be between 1 and 65535'),
  STUDIO_MODEL_RUNTIME_URL: z.string().url(),
  STUDIO_LOG_LEVEL: logLevelSchema,
})

export type StudioEnv = Readonly<{
  dataRoot: string
  port: number
  modelRuntimeUrl: string
  logLevel: z.infer<typeof logLevelSchema>
}>

/**
 * No entry here supplies a default: an absent STUDIO_* variable is a startup
 * failure naming it, never a value nobody chose (SPEC "Deployment").
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): StudioEnv {
  const missing = VARIABLES.filter((name) => !source[name])
  if (missing.length > 0) {
    throw new Error(`missing required environment variable(s): ${missing.join(', ')}`)
  }

  const result = shapeSchema.safeParse({
    STUDIO_DATA_ROOT: source.STUDIO_DATA_ROOT,
    STUDIO_PORT: source.STUDIO_PORT,
    STUDIO_MODEL_RUNTIME_URL: source.STUDIO_MODEL_RUNTIME_URL,
    STUDIO_LOG_LEVEL: source.STUDIO_LOG_LEVEL,
  })

  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(`invalid environment variable ${String(issue?.path[0])}: ${issue?.message}`)
  }

  return Object.freeze({
    dataRoot: result.data.STUDIO_DATA_ROOT,
    port: result.data.STUDIO_PORT,
    modelRuntimeUrl: result.data.STUDIO_MODEL_RUNTIME_URL,
    logLevel: result.data.STUDIO_LOG_LEVEL,
  })
}
