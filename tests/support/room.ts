import type { Clock } from '../../src/shared/clock.js'
import { createLogger } from '../../src/server/logger.js'
import type { Charter } from '../../src/server/model/charter.js'
import type { PromptFragments } from '../../src/server/model/prompts.js'
import type { ModelAccess } from '../../src/server/model/types.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import type { HistoryPolicy } from '../../src/server/room/context.js'
import { Room } from '../../src/server/room/room.js'
import { resolveRoster } from '../../src/server/room/roster.js'
import { ConversationEntryStore } from '../../src/server/store/index.js'

/** Every value a Room's behaviour turns on, stated by the test rather than assumed here. */
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
  return new Room(
    spec.modelAccess,
    new ConversationEntryStore(),
    dataRoot,
    resolveRoster(spec.roles),
    spec.modes,
    spec.charter,
    spec.fragments,
    spec.policy,
    createLogger('silent'),
    spec.now,
    spec.authorContextReference,
  )
}
