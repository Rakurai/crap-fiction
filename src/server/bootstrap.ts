import type { Hono } from 'hono'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { InterfaceTheme } from './interfaceTheme.js'
import { createLogger, type Logger } from './logger.js'
import { CallSiteAssignments } from './model/assignments.js'
import type { ModelAccess } from './model/types.js'
import { PieceDocumentWriter, PieceStore } from './pieces.js'
import { SHIPPED_HISTORY_POLICY } from './room/context.js'
import { Room } from './room/room.js'
import { CONTENT_ROOT, ShippedContentCatalog } from './shippedContent.js'
import { AuthorContextStore, ConversationEntryStore, DraftStore, PieceMetadataStore, SettingsStore, StoryContextStore } from './store/index.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
}

export { CONTENT_ROOT }

export function bootstrap(makeModelAccess: (env: StudioEnv, logger: Logger) => ModelAccess): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const settingsStore = new SettingsStore()
  const pieceMetadataStore = new PieceMetadataStore()
  const workspace = WorkspaceRegistry.openAt(env.dataRoot, settingsStore)
  const catalog = ShippedContentCatalog.load(CONTENT_ROOT)
  const documentWriter = new PieceDocumentWriter(new DraftStore(), new StoryContextStore(), new AuthorContextStore(), env.dataRoot)
  const pieceStore = new PieceStore(env.dataRoot, pieceMetadataStore)
  const interfaceTheme = new InterfaceTheme(env.dataRoot, settingsStore)
  const callSiteAssignments = new CallSiteAssignments(env.dataRoot, catalog.callSites, settingsStore)
  const modelAccess = makeModelAccess(env, logger)
  const room = new Room(modelAccess, new ConversationEntryStore(), pieceMetadataStore, env.dataRoot, catalog, SHIPPED_HISTORY_POLICY, logger, Date.now)
  return {
    app: createApp(env, workspace, catalog, documentWriter, pieceStore, interfaceTheme, callSiteAssignments, modelAccess, room, logger),
  }
}
