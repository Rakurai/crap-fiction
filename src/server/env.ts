import { z } from 'zod'
import { firstSchemaIssue } from '../shared/schemaIssue.js'
import { isAbsoluteLocation, isExistingDirectory } from './store/index.js'

export const STUDIO_VARIABLES = [
  'STUDIO_DATA_ROOT',
  'STUDIO_PORT',
  'STUDIO_MODEL_RUNTIME_URL',
  'STUDIO_LOG_LEVEL',
  'STUDIO_TRACE',
] as const

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])

const traceSchema = z.enum(['on', 'off'])

const shapeSchema = z.object({
  STUDIO_DATA_ROOT: z
    .string()
    .min(1)
    .refine(isAbsoluteLocation, 'must be an absolute path')
    .refine(isExistingDirectory, 'must be an existing directory'),
  STUDIO_PORT: z
    .string()
    .regex(/^\d+$/, 'must be a positive integer')
    .transform(Number)
    .refine((port) => port >= 1 && port <= 65535, 'must be between 1 and 65535'),
  STUDIO_MODEL_RUNTIME_URL: z.string().url(),
  STUDIO_LOG_LEVEL: logLevelSchema,
  STUDIO_TRACE: traceSchema,
})

export type StudioEnv = Readonly<{
  dataRoot: string
  port: number
  modelRuntimeUrl: string
  logLevel: z.infer<typeof logLevelSchema>
  trace: z.infer<typeof traceSchema>
}>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): StudioEnv {
  const missing = STUDIO_VARIABLES.filter((name) => !source[name])
  if (missing.length > 0) {
    throw new Error(`missing required environment variable(s): ${missing.join(', ')}`)
  }

  const result = shapeSchema.safeParse({
    STUDIO_DATA_ROOT: source.STUDIO_DATA_ROOT,
    STUDIO_PORT: source.STUDIO_PORT,
    STUDIO_MODEL_RUNTIME_URL: source.STUDIO_MODEL_RUNTIME_URL,
    STUDIO_LOG_LEVEL: source.STUDIO_LOG_LEVEL,
    STUDIO_TRACE: source.STUDIO_TRACE,
  })

  if (!result.success) {
    const { entry, message } = firstSchemaIssue(result.error)
    throw new Error(`invalid environment variable ${entry}: ${message}`)
  }

  return Object.freeze({
    dataRoot: result.data.STUDIO_DATA_ROOT,
    port: result.data.STUDIO_PORT,
    modelRuntimeUrl: result.data.STUDIO_MODEL_RUNTIME_URL,
    logLevel: result.data.STUDIO_LOG_LEVEL,
    trace: result.data.STUDIO_TRACE,
  })
}
