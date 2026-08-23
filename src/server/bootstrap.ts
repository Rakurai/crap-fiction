import path from 'node:path'
import type { Hono } from 'hono'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'
import { getAssignment } from './model/assignments.js'
import { callSites } from './model/callSites.js'
import { loadCharter, type Charter } from './model/charter.js'
import { LMStudioAdapter } from './model/lmStudioAdapter.js'
import { ModelAccess } from './model/modelAccess.js'
import { loadRoles, type RoleDefinition } from './model/roles.js'
import { loadModes, type ModeDescriptor } from './modes.js'
import { DraftWriter } from './pieces.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
  readonly env: StudioEnv
  readonly logger: Logger
  readonly workspace: WorkspaceRegistry
  readonly modes: readonly ModeDescriptor[]
  readonly charter: Charter
  readonly roles: readonly RoleDefinition[]
}

/**
 * The one place startup validation happens: an absent or malformed
 * STUDIO_* variable, invalid shipped mode data, invalid shipped role data,
 * or an invalid shipped charter, throws here before anything else runs. The
 * workspace path is read here too and only here — SPEC "Files" holds it as
 * process configuration rather than data re-read per request. `callSites`
 * is invoked for its validation alone: a participant id colliding with an
 * operation site is also a startup failure, not something a request should
 * discover.
 */
export function bootstrap(): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const workspace = new WorkspaceRegistry(env.dataRoot)
  workspace.load()
  const modes = loadModes(path.join(import.meta.dirname, 'modes'))
  const roles = loadRoles(path.join(import.meta.dirname, 'model', 'roles'))
  const charter = loadCharter(path.join(import.meta.dirname, 'model', 'charter.yaml'))
  callSites(roles)
  const draftWriter = new DraftWriter()
  const modelAdapter = new LMStudioAdapter(env.modelRuntimeUrl)
  const modelAccess = new ModelAccess(modelAdapter, (site) => getAssignment(env.dataRoot, site))
  const app = createApp(env, workspace, modes, draftWriter, roles, modelAccess)
  return { app, env, logger, workspace, modes, charter, roles }
}
