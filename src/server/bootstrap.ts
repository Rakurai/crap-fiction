import type { Hono } from 'hono'
import { createApp } from './app.js'
import { loadEnv, type StudioEnv } from './env.js'
import { createLogger, type Logger } from './logger.js'
import type { ModelAccess } from './model/types.js'
import { PieceDocumentWriter } from './pieces.js'
import { SHIPPED_HISTORY_POLICY } from './room/context.js'
import { Room } from './room/room.js'
import { CONTENT_ROOT, ShippedContentCatalog } from './shippedContent.js'
import { AuthorContextStore, ConversationEntryStore, DraftStore, StoryContextStore } from './store/index.js'
import { WorkspaceRegistry } from './workspace.js'

export type Studio = {
  readonly app: Hono
}

export { CONTENT_ROOT }

export function bootstrap(makeModelAccess: (env: StudioEnv, logger: Logger) => ModelAccess): Studio {
  const env = loadEnv()
  const logger = createLogger(env.logLevel)
  logger.info({ port: env.port }, 'studio starting')
  const workspace = WorkspaceRegistry.openAt(env.dataRoot)
  const catalog = ShippedContentCatalog.load(CONTENT_ROOT)
  const documentWriter = new PieceDocumentWriter(new DraftStore(), new StoryContextStore(), new AuthorContextStore(), env.dataRoot)
  const modelAccess = makeModelAccess(env, logger)
  const room = new Room(modelAccess, new ConversationEntryStore(), env.dataRoot, catalog, SHIPPED_HISTORY_POLICY, logger, Date.now)
  return { app: createApp(env, workspace, catalog, documentWriter, modelAccess, room, logger) }
}
