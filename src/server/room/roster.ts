import type { RoleDefinition } from '../model/roles.js'

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
}>

export function resolveRoster(roles: readonly RoleDefinition[]): RoomRoster {
  const specialists = roles.filter((role) => role.eligibility === 'cast')

  const storyEditor = roles.find((role) => role.eligibility === 'generalist')
  if (storyEditor === undefined) throw new GeneralistNotInRosterError()

  const addressedOnly = roles.filter((role) => role.eligibility === 'addressed-only')

  return { specialists, storyEditor, addressedOnly }
}
