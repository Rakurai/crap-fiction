import { CHARTER_FIXTURE } from './charter.js'
import type { Charter } from '../../src/server/model/charter.js'
import { ModelAccess } from '../../src/server/model/modelAccess.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { Room } from '../../src/server/room/room.js'
import { FixtureModelAdapter } from './modelAdapter.js'

export const DEFAULT_MODE: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }],
}

export const DEFAULT_ROLES: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]

/**
 * A `ModelAccess` no call ever reaches: every site resolves to no
 * assignment, so a call fails as unconfigured before the adapter beneath it
 * is ever asked for a result — and that adapter has none to give, scripted
 * for no site, so a call that somehow reached it would fail loudly rather
 * than hand back a value nobody scripted. `buildTestRoom`'s default, for a
 * test that constructs a room only for the app to wire up and never asks it
 * to run a round — a test that does override `modelAccess` with one of its
 * own.
 */
function unreachableModelAccess(): ModelAccess {
  return new ModelAccess(FixtureModelAdapter.bySite({}, { reachable: true, models: [] }), () => undefined)
}

export type RoomOverrides = Readonly<{
  mode?: ModeDescriptor
  roles?: readonly RoleDefinition[]
  charter?: Charter
  modelAccess?: ModelAccess
}>

/**
 * The one place a test builds a `Room` directly. The charter a
 * room needs is `CHARTER_FIXTURE`, declared once beside this file,
 * rather than a literal repeated per file that must be kept in agreement with
 * it by hand.
 */
export function buildTestRoom(overrides: RoomOverrides = {}): Room {
  return new Room(
    overrides.modelAccess ?? unreachableModelAccess(),
    overrides.roles ?? DEFAULT_ROLES,
    overrides.charter ?? CHARTER_FIXTURE,
    overrides.mode ?? DEFAULT_MODE,
  )
}
