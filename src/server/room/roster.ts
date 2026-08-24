import type { RoleDefinition } from '../model/roles.js'
import type { ModeDescriptor } from '../modes.js'
import type { SpecialistCriteria } from './context.js'

export class CastMemberWithoutRoleError extends Error {
  constructor(modeId: string, memberId: string) {
    super(`mode "${modeId}" names cast member "${memberId}" with no matching role definition`)
    this.name = 'CastMemberWithoutRoleError'
  }
}

export class StoryEditorNotResolvedError extends Error {
  constructor(found: number) {
    super(`expected exactly one participant outside the mode's cast (the Story Editor), found ${found}`)
    this.name = 'StoryEditorNotResolvedError'
  }
}

export type RoomRoster = Readonly<{
  specialists: readonly RoleDefinition[]
  storyEditor: RoleDefinition
  criteria: ReadonlyMap<string, SpecialistCriteria>
}>

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
