import { CHARTER_FIXTURE } from './charter.js'
import type { Clock } from '../../src/shared/clock.js'
import { createLogger } from '../../src/server/logger.js'
import type { Charter } from '../../src/server/model/charter.js'
import type { ModelAccess } from '../../src/server/model/types.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { SHIPPED_HISTORY_POLICY, type HistoryPolicy } from '../../src/server/room/context.js'
import { authorContextStore, durableContextReader } from '../../src/server/room/durableContext.js'
import { Room } from '../../src/server/room/room.js'
import { resolveRoster } from '../../src/server/room/roster.js'
import { ConversationEntryStore } from '../../src/server/store/index.js'
import { FixtureModelAdapter } from './modelAdapter.js'

export const MODE_FIXTURE: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }],
}

export const ROLES_FIXTURE: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]

function unscriptedModelAccess(): ModelAccess {
  return FixtureModelAdapter.bySite({}, undefined)
}

export type RoomOverrides = Readonly<{
  mode?: ModeDescriptor
  roles?: readonly RoleDefinition[]
  charter?: Charter
  modelAccess?: ModelAccess
  policy?: HistoryPolicy
  now?: Clock
}>

export function buildTestRoom(dataRoot: string, overrides: RoomOverrides = {}): Room {
  return new Room(
    overrides.modelAccess ?? unscriptedModelAccess(),
    durableContextReader(dataRoot),
    authorContextStore(dataRoot),
    new ConversationEntryStore(),
    resolveRoster(overrides.mode ?? MODE_FIXTURE, overrides.roles ?? ROLES_FIXTURE),
    overrides.charter ?? CHARTER_FIXTURE,
    overrides.policy ?? SHIPPED_HISTORY_POLICY,
    createLogger('silent'),
    overrides.now ?? Date.now,
  )
}
