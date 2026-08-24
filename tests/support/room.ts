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
import { FixtureModelAdapter } from './modelAdapter.js'

/**
 * Stand-ins for the three pieces of shipped data a room is built from. They are
 * fixtures, not harness defaults: the product supplies these from `modes/`,
 * `model/roles/` and `charter.yaml`, so a test standing a room up needs
 * something in their place, and one literal declared here is what keeps every
 * such test agreeing about who is in the room. Nothing here stands in for a
 * value the product would not supply — a scripted response and a model
 * assignment stay the individual test's to state (CODING_STANDARDS "A harness is
 * not a fixture").
 */
export const MODE_FIXTURE: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }],
}

export const ROLES_FIXTURE: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]

/**
 * A model seam no call ever reaches: scripted for no site and for no runtime
 * status, so a call fails loudly rather than hand back a value nobody scripted.
 * This is what a room gets when a test constructs one only for the app to wire
 * up and never asks it to run a round — a test that does asks for a room with
 * its own model access.
 */
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

/**
 * The one place a test builds a `Room` directly.
 *
 * The history policy comes from the product's own statement of it rather than
 * from a literal chosen here, so a room a test did not ask to compile history
 * differently behaves as the studio does; a test about the other policy names it
 * (SPEC "Context compilation": switching is a configuration change).
 *
 * `dataRoot` is required rather than overridable because a room reads the
 * author's durable context from under it on every round, through the product's
 * own reader: a test that wrote a context file gets it, and one that wrote none
 * gets a room whose participants are told nothing the author did not write.
 *
 * The logger is the product's own, at the level the studio silences with — a room
 * under test writes to stderr as the real one does, and nothing here asserts what
 * it wrote. That a failure is logged and that it is reported to the author are the
 * same decision in `Room`; the reported half is what the tests read.
 *
 * The clock is the product's own too. A test that reads the moment a round opened
 * states its own instead, which is the whole reason the room takes one.
 */
export function buildTestRoom(dataRoot: string, overrides: RoomOverrides = {}): Room {
  return new Room(
    overrides.modelAccess ?? unscriptedModelAccess(),
    durableContextReader(dataRoot),
    authorContextStore(dataRoot),
    resolveRoster(overrides.mode ?? MODE_FIXTURE, overrides.roles ?? ROLES_FIXTURE),
    overrides.charter ?? CHARTER_FIXTURE,
    overrides.policy ?? SHIPPED_HISTORY_POLICY,
    createLogger('silent'),
    overrides.now ?? Date.now,
  )
}
