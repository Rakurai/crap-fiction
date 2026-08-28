import type { Clock } from '../../src/shared/clock.js'
import { createLogger } from '../../src/server/logger.js'
import type { Charter } from '../../src/server/model/charter.js'
import type { PromptFragments } from '../../src/server/model/prompts.js'
import type { ModelAccess } from '../../src/server/model/types.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { createComputeAppliedChangeContent } from '../../src/server/room/appliedChange.js'
import type { HistoryPolicy } from '../../src/server/room/context.js'
import { Room } from '../../src/server/room/room.js'
import { ShippedContentCatalog } from '../../src/server/shippedContent.js'
import { ConversationEntryStore, PieceMetadataStore } from '../../src/server/store/index.js'

export type RoomSpec = Readonly<{
  modes: readonly ModeDescriptor[]
  roles: readonly RoleDefinition[]
  charter: Charter
  fragments: PromptFragments
  policy: HistoryPolicy
  modelAccess: ModelAccess
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
    new ConversationEntryStore(),
    new PieceMetadataStore(),
    dataRoot,
    catalog,
    spec.policy,
    createLogger('silent'),
    spec.now,
    createComputeAppliedChangeContent({ contextWords: 8, unboundedFraction: 0.5 }),
  )
}
