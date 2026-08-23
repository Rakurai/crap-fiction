import type { RoleDefinition } from '../model/roles.js'
import type { ModeDescriptor } from '../modes.js'
import type { SpecialistCriteria } from './context.js'

/**
 * A mode names a cast member no shipped role defines. Shipped data broken this
 * way is a startup failure rather than something a round discovers: the round
 * that discovered it would already have been promised to the author.
 */
export class CastMemberWithoutRoleError extends Error {
  constructor(modeId: string, memberId: string) {
    super(`mode "${modeId}" names cast member "${memberId}" with no matching role definition`)
    this.name = 'CastMemberWithoutRoleError'
  }
}

/**
 * The roster does not resolve to exactly one participant outside the cast. The
 * Story Editor is identified by being that one, so none and several are the same
 * failure: neither leaves the room a judgment to compile.
 */
export class StoryEditorNotResolvedError extends Error {
  constructor(found: number) {
    super(`expected exactly one participant outside the mode's cast (the Story Editor), found ${found}`)
    this.name = 'StoryEditorNotResolvedError'
  }
}

/**
 * Who is in the room, and what each of them attends to. This is what the room is
 * built from rather than the mode and the roster it was derived from — the room
 * asks who its participants are, never who might have been.
 */
export type RoomRoster = Readonly<{
  specialists: readonly RoleDefinition[]
  storyEditor: RoleDefinition
  /**
   * The mode's criteria, by the participant they belong to (SPEC "Context
   * compilation"). The Story Editor is absent from it, being no part of the cast,
   * so a lookup for it finds nothing — which is the same answer as a specialist
   * the mode named no criteria for, and both are what its role definition alone
   * is then compiled from.
   */
  criteria: ReadonlyMap<string, SpecialistCriteria>
}>

/**
 * CONTEXT "Room"/"Mode": the cast is the mode's specialists; the Story Editor is
 * always present and is not one of them. The shipped roster names every
 * participant, so whichever one the mode's cast does not name is the Story Editor.
 *
 * Resolved at the composition root rather than inside the room, because every way
 * this can fail is shipped data being wrong, and the place that reads shipped data
 * is where wrong shipped data should stop the studio (CODING_STANDARDS "Failures":
 * a startup failure is loud and a request-time one is a promise already made).
 */
export function resolveRoster(mode: ModeDescriptor, roles: readonly RoleDefinition[]): RoomRoster {
  const castIds = new Set(mode.cast.map((specialist) => specialist.id))
  const specialists = mode.cast.map((specialist) => {
    const role = roles.find((candidate) => candidate.id === specialist.id)
    if (role === undefined) throw new CastMemberWithoutRoleError(mode.id, specialist.id)
    return role
  })

  const outsideCast = roles.filter((role) => !castIds.has(role.id))
  const [storyEditor, ...beyondOne] = outsideCast
  if (storyEditor === undefined || beyondOne.length > 0) {
    throw new StoryEditorNotResolvedError(outsideCast.length)
  }

  return {
    specialists,
    storyEditor,
    criteria: new Map(mode.cast.map((specialist) => [specialist.id, { attendsTo: specialist.attendsTo, defect: specialist.defect }])),
  }
}
