import type { RoleDefinition } from '../model/roles.js'
import type { ModeDescriptor } from '../modes.js'
import type { SpecialistCriteria } from './context.js'

export class CastMemberWithoutRoleError extends Error {
  constructor(modeId: string, memberId: string) {
    super(`mode "${modeId}" names cast member "${memberId}" with no matching role definition`)
    this.name = 'CastMemberWithoutRoleError'
  }
}

export class GeneralistNotInRosterError extends Error {
  constructor() {
    super('no participant among the loaded roles declares itself the generalist')
    this.name = 'GeneralistNotInRosterError'
  }
}

export type RoomRoster = Readonly<{
  specialists: readonly RoleDefinition[]
  storyEditor: RoleDefinition
  addressedOnly: readonly RoleDefinition[]
  criteria: ReadonlyMap<string, SpecialistCriteria>
}>

export function resolveRoster(mode: ModeDescriptor, roles: readonly RoleDefinition[]): RoomRoster {
  const specialists = mode.cast.map((specialist) => {
    const role = roles.find((candidate) => candidate.id === specialist.id)
    if (role === undefined) throw new CastMemberWithoutRoleError(mode.id, specialist.id)
    return role
  })

  const storyEditor = roles.find((role) => role.eligibility === 'generalist')
  if (storyEditor === undefined) throw new GeneralistNotInRosterError()

  const addressedOnly = roles.filter((role) => role.eligibility === 'addressed-only')

  return {
    specialists,
    storyEditor,
    addressedOnly,
    criteria: new Map(mode.cast.map((specialist) => [specialist.id, { attendsTo: specialist.attendsTo, defect: specialist.defect }])),
  }
}
