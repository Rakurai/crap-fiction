import type { Clock } from '../../src/shared/clock.js'
import type { Logger } from '../../src/server/logger.js'
import type { Charter } from '../../src/server/model/charter.js'
import type { PromptFragments } from '../../src/server/model/prompts.js'
import type { ModelAccess } from '../../src/server/model/types.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { createComputeAppliedChangeContent } from '../../src/server/room/appliedChange.js'
import type { HistoryPolicy } from '../../src/server/room/context.js'
import { Room, type ApplyingConfig } from '../../src/server/room/room.js'
import { ShippedContentCatalog } from '../../src/server/shippedContent.js'
import { ConversationEntryStore, PieceMetadataStore } from '../../src/server/store/index.js'

type RoomSpec = Readonly<{
  modes: readonly ModeDescriptor[]
  roles: readonly RoleDefinition[]
  charter: Charter
  fragments: PromptFragments
  policy: HistoryPolicy
  applying: ApplyingConfig
  modelAccess: ModelAccess
  entries: ConversationEntryStore
  logger: Logger
  now: Clock
  authorContextReference: string
}>

export function buildTestRoom(dataRoot: string, spec: RoomSpec): Room {
  const catalog = ShippedContentCatalog.assemble({
    modes: spec.modes,
    roles: spec.roles,
    charter: spec.charter,
    fragments: spec.fragments,
    authorContextReference: spec.authorContextReference,
  })
  return new Room(
    spec.modelAccess,
    spec.entries,
    new PieceMetadataStore(),
    dataRoot,
    catalog,
    spec.policy,
    spec.applying,
    spec.logger,
    spec.now,
    createComputeAppliedChangeContent({ contextWords: 8, unboundedFraction: 0.5 }),
  )
}
