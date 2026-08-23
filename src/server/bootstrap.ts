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
import { Room } from './room/room.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
  readonly env: StudioEnv
  readonly logger: Logger
  readonly workspace: WorkspaceRegistry
  readonly mode: ModeDescriptor
  readonly charter: Charter
  readonly roles: readonly RoleDefinition[]
}

/**
 * The one place startup validation happens: an absent or malformed
 * STUDIO_* variable, invalid or non-singular shipped mode data, invalid
 * shipped role data, or an invalid shipped charter, throws here before
 * anything else runs. The workspace path is read here too and only here —
 * SPEC "Files" holds it as process configuration rather than data re-read per
 * request. `callSites` both validates the roster — a participant id
 * colliding with an operation site is a startup failure, not something a
 * request should discover — and produces the one `sites` value the app is
 * built with, so it is constructed here once rather than again inside it.
 */
export function bootstrap(): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const workspace = new WorkspaceRegistry(env.dataRoot)
  workspace.load()
  const mode = loadModes()
  const roles = loadRoles()
  const charter = loadCharter()
  const sites = callSites(roles)
  const draftWriter = new DraftWriter()
  const modelAdapter = new LMStudioAdapter(env.modelRuntimeUrl)
  const modelAccess = new ModelAccess(modelAdapter, (site) => getAssignment(env.dataRoot, site))
  const room = new Room(modelAccess, roles, charter, mode)
  const app = createApp(env, workspace, mode, draftWriter, sites, modelAccess, room)
  return { app, env, logger, workspace, mode, charter, roles }
}
