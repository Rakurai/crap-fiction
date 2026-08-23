import { CHARTER_FIXTURE } from './charter.js'
import type { Charter } from '../../src/server/model/charter.js'
import { ModelAccess } from '../../src/server/model/modelAccess.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { SHIPPED_HISTORY_POLICY, type HistoryPolicy } from '../../src/server/room/context.js'
import { Room } from '../../src/server/room/room.js'
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
 * A `ModelAccess` no call ever reaches: every site resolves to no
 * assignment, so a call fails as unconfigured before the adapter beneath it
 * is ever asked for a result — and that adapter has none to give, scripted
 * for no site and for no runtime status, so a call that somehow reached it would
 * fail loudly rather than hand back a value nobody scripted. This is what a
 * room gets when a test constructs one only for the app to wire up and never
 * asks it to run a round — a test that does asks for a room with its own model
 * access.
 */
function unreachableModelAccess(): ModelAccess {
  return new ModelAccess(FixtureModelAdapter.bySite({}, undefined), () => undefined)
}

export type RoomOverrides = Readonly<{
  mode?: ModeDescriptor
  roles?: readonly RoleDefinition[]
  charter?: Charter
  modelAccess?: ModelAccess
  policy?: HistoryPolicy
}>

/**
 * The one place a test builds a `Room` directly.
 *
 * The history policy comes from the product's own statement of it rather than
 * from a literal chosen here, so a room a test did not ask to compile history
 * differently behaves as the studio does; a test about the other policy names it
 * (SPEC "Context compilation": switching is a configuration change).
 */
export function buildTestRoom(overrides: RoomOverrides = {}): Room {
  return new Room(
    overrides.modelAccess ?? unreachableModelAccess(),
    overrides.roles ?? ROLES_FIXTURE,
    overrides.charter ?? CHARTER_FIXTURE,
    overrides.mode ?? MODE_FIXTURE,
    overrides.policy ?? SHIPPED_HISTORY_POLICY,
  )
}
