import path from 'node:path'
import type { Hono } from 'hono'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'
import { loadModes, type ModeDescriptor } from './modes.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
  readonly env: StudioEnv
  readonly logger: Logger
  readonly workspace: WorkspaceRegistry
  readonly modes: readonly ModeDescriptor[]
}

/**
 * The one place startup validation happens: an absent or malformed
 * STUDIO_* variable, or invalid shipped mode data, throws here before
 * anything else runs. The workspace path is read here too and only here —
 * SPEC "Files" holds it as process configuration rather than data re-read
 * per request.
 */
export function bootstrap(): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const workspace = new WorkspaceRegistry(env.dataRoot)
  workspace.load()
  const modes = loadModes(path.join(import.meta.dirname, 'modes'))
  const app = createApp(env, workspace, modes)
  return { app, env, logger, workspace, modes }
}
