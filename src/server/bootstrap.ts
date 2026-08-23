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
import { durableContextReader } from './room/durableContext.js'
import { Room } from './room/room.js'
import { resolveRoster } from './room/roster.js'
import { DraftStore } from './store/index.js'
import { WorkspaceRegistry } from './workspace.js'

/**
 * The application, and nothing else. Everything startup validated or constructed
 * on the way here is reachable from the app that was built with it, so handing any
 * of it back a second time would offer both entries a second way to the same
 * values — and a second way in is a second place a decision can be made.
 */
export type Studio = {
  readonly app: Hono
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
 *
 * How the studio reaches models is the caller's to supply, because SPEC
 * "Verification" needs a studio answering from the fixture model implementation
 * and the deployment the author runs must have no way to ask for one. It is a
 * parameter rather than a variable or a flag: the four STUDIO_* variables are a
 * closed set, and a fifth would put the fixture within reach of the studio the
 * author writes in. It takes the environment because the runtime's address is
 * read here and only here, and the logger because the model boundary is one of
 * the seams that logs.
 *
 * One logger is constructed here and handed to every seam that owns an operation
 * — the model boundary, the room, the HTTP layer. It is a value passed down
 * rather than a module anything imports for itself (CODING_STANDARDS "No
 * module-level mutable singletons"), which is what keeps what it is and where it
 * writes one decision made in one place.
 */
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
  // Who is in the room is resolved here, where every way it can fail is shipped
  // data being wrong and a startup failure is what that deserves.
  const roster = resolveRoster(mode, roles)
  // The clock is the room's last argument for the same reason the logger is one at
  // all: reading the wall clock is a dependency, and the composition root is where
  // the studio's real one is named (CODING_STANDARDS "Time").
  const room = new Room(modelAccess, durableContextReader(env.dataRoot), roster, charter, SHIPPED_HISTORY_POLICY, logger, Date.now)
  return { app: createApp(env, workspace, mode, draftWriter, sites, modelAccess, room, logger) }
}
