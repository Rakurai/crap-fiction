import { INTERVIEWER_FUNCTION, type RoleDefinition } from '../model/roles.js'
import type { SurfaceId } from '../../shared/surfaces.js'

export class GeneralistNotInRosterError extends Error {
  constructor() {
    super('no participant among the loaded roles declares itself the generalist')
    this.name = 'GeneralistNotInRosterError'
  }
}

export class InterviewerNotInRosterError extends Error {
  constructor() {
    super('no participant among the loaded roles declares the interviewer function')
    this.name = 'InterviewerNotInRosterError'
  }
}

/** The declared Interviewer as its callers need it: the participant, and the words its affordance sends. */
export type Interviewer = Readonly<{
  role: RoleDefinition
  invocation: string
}>

export type RoomRoster = Readonly<{
  specialists: readonly RoleDefinition[]
  storyEditor: RoleDefinition
  addressedOnly: readonly RoleDefinition[]
  interviewer: Interviewer
}>

export function resolveRoster(roles: readonly RoleDefinition[]): RoomRoster {
  const specialists = roles.filter((role) => role.eligibility === 'cast')

  // Unreachable for loaded content: the loader refuses a set that does not declare exactly one generalist.
  const storyEditor = roles.find((role) => role.eligibility === 'generalist')
  if (storyEditor === undefined) throw new GeneralistNotInRosterError()

  const addressedOnly = roles.filter((role) => role.eligibility === 'addressed-only')

  // Unreachable for loaded content on the same terms: the loader refuses a set that does not declare
  // the function exactly once. Reading the invocation here is what keeps every caller from renarrowing.
  const declared = addressedOnly.find((role) => role.function?.name === INTERVIEWER_FUNCTION)
  const invocation = declared?.function?.invocation
  if (declared === undefined || invocation === undefined) throw new InterviewerNotInRosterError()

  return { specialists, storyEditor, addressedOnly, interviewer: { role: declared, invocation } }
}

export function specialistsFor(specialists: readonly RoleDefinition[], modeId: string, surface: SurfaceId): readonly RoleDefinition[] {
  return specialists.filter((role) => role.availability.some((entry) => entry.mode === modeId && entry.surface === surface))
}

export function defaultCastFor(specialists: readonly RoleDefinition[], modeId: string, surface: SurfaceId): readonly string[] {
  return specialistsFor(specialists, modeId, surface)
    .filter((role) => role.availability.some((entry) => entry.mode === modeId && entry.surface === surface && entry.enabledByDefault))
    .map((role) => role.id)
}
