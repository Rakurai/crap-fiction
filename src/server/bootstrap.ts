import type { Hono } from 'hono'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'

export type Studio = {
  readonly app: Hono
  readonly env: StudioEnv
  readonly logger: Logger
}

/**
 * The one place startup validation happens: an absent or malformed
 * STUDIO_* variable throws here, naming it, before anything else runs.
 */
export function bootstrap(): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const app = createApp(env)
  return { app, env, logger }
}
