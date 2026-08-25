import type { Hono } from 'hono'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'
import { callSites } from './model/callSites.js'
import { loadCharter, type Charter } from './model/charter.js'
import type { ModelAccess } from './model/types.js'
import { loadRoles, type RoleDefinition } from './model/roles.js'
import { loadModes, type ModeDescriptor } from './modes.js'
import { DraftWriter } from './pieces.js'
import { SHIPPED_HISTORY_POLICY } from './room/context.js'
import { authorContextStore, durableContextReader } from './room/durableContext.js'
import { Room } from './room/room.js'
import { resolveRoster } from './room/roster.js'
import { ConversationEntryStore, DraftStore } from './store/index.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
}

export function bootstrap(makeModelAccess: (env: StudioEnv, logger: Logger) => ModelAccess): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const workspace = WorkspaceRegistry.openAt(env.dataRoot)
  const mode = loadModes()
  const roles = loadRoles()
  const charter = loadCharter()
  const sites = callSites(roles)
  const draftWriter = new DraftWriter(new DraftStore())
  const modelAccess = makeModelAccess(env, logger)
  const roster = resolveRoster(mode, roles)
  const room = new Room(
    modelAccess,
    durableContextReader(env.dataRoot),
    authorContextStore(env.dataRoot),
    new ConversationEntryStore(),
    roster,
    charter,
    SHIPPED_HISTORY_POLICY,
    logger,
    Date.now,
  )
  return { app: createApp(env, workspace, mode, draftWriter, sites, modelAccess, room, logger) }
}
