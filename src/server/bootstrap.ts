import type { Hono } from 'hono'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
  readonly env: StudioEnv
  readonly logger: Logger
  readonly workspace: WorkspaceRegistry
}

/**
 * The one place startup validation happens: an absent or malformed
 * STUDIO_* variable throws here, naming it, before anything else runs. The
 * workspace path is read here too and only here — SPEC "Files" holds it as
 * process configuration rather than data re-read per request.
 */
export function bootstrap(): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const workspace = new WorkspaceRegistry(env.dataRoot)
  workspace.load()
  const app = createApp(env, workspace)
  return { app, env, logger, workspace }
}
