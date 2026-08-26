import type { Hono } from 'hono'
import path from 'node:path'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'
import { callSites, type CallSiteDescriptor } from './model/callSites.js'
import { loadCharter, type Charter } from './model/charter.js'
import { loadPromptFragments, type PromptFragments } from './model/prompts.js'
import type { ModelAccess } from './model/types.js'
import { loadRoles, type RoleDefinition } from './model/roles.js'
import { loadModes, type ModeDescriptor } from './modes.js'
import { PieceDocumentWriter } from './pieces.js'
import { SHIPPED_HISTORY_POLICY } from './room/context.js'
import { Room } from './room/room.js'
import { resolveRoster, type RoomRoster } from './room/roster.js'
import { ConversationEntryStore, DraftStore, readShippedAuthorContextReference, StoryContextStore } from './store/index.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
}

export const CONTENT_ROOT = path.join(import.meta.dirname, '..', '..', 'content')

export type ShippedContent = Readonly<{
  modes: readonly ModeDescriptor[]
  roles: readonly RoleDefinition[]
  charter: Charter
  fragments: PromptFragments
  sites: readonly CallSiteDescriptor[]
  roster: RoomRoster
  authorContextReference: string
}>

export function loadShippedContent(contentRoot: string): ShippedContent {
  const modes = loadModes(contentRoot)
  const roles = loadRoles(contentRoot, new Set(modes.map((mode) => mode.id)))
  const charter = loadCharter(contentRoot)
  const fragments = loadPromptFragments(contentRoot)
  const sites = callSites(roles)
  const roster = resolveRoster(roles)
  const authorContextReference = readShippedAuthorContextReference(contentRoot)
  return { modes, roles, charter, fragments, sites, roster, authorContextReference }
}

export function bootstrap(makeModelAccess: (env: StudioEnv, logger: Logger) => ModelAccess): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const workspace = WorkspaceRegistry.openAt(env.dataRoot)
  const { modes, charter, fragments, sites, roster, authorContextReference } = loadShippedContent(CONTENT_ROOT)
  const documentWriter = new PieceDocumentWriter(new DraftStore(), new StoryContextStore())
  const modelAccess = makeModelAccess(env, logger)
  const room = new Room(
    modelAccess,
    new ConversationEntryStore(),
    env.dataRoot,
    roster,
    modes,
    charter,
    fragments,
    SHIPPED_HISTORY_POLICY,
    logger,
    Date.now,
    authorContextReference,
  )
  return { app: createApp(env, workspace, modes, documentWriter, sites, modelAccess, room, logger, authorContextReference) }
}
