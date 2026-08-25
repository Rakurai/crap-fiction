import { z } from 'zod'
import { handlePattern } from '../../shared/handle.js'
import { surfaceIdSchema, type SurfaceId } from '../../shared/surfaces.js'
import { readShippedParticipants, ShippedDataError } from '../store/index.js'

const eligibilitySchema = z.enum(['cast', 'generalist', 'addressed-only'])

export type Eligibility = z.infer<typeof eligibilitySchema>

const availabilityEntrySchema = z.object({
  mode: z.string().min(1),
  surface: surfaceIdSchema,
  enabledByDefault: z.boolean(),
})

export type AvailabilityEntry = Readonly<{
  mode: string
  surface: SurfaceId
  enabledByDefault: boolean
}>

const participantFrontmatterSchema = z.object({
  handle: z.string().regex(handlePattern, 'must be one lowercase token, distinct from the display name'),
  displayName: z.string().min(1),
  description: z.string().min(1),
  eligibility: eligibilitySchema,
  availability: z.array(availabilityEntrySchema).default([]),
})

export type RoleDefinition = Readonly<{
  id: string
  handle: string
  displayName: string
  description: string
  persona: string
  eligibility: Eligibility
  availability: readonly AvailabilityEntry[]
}>

export class GeneralistCardinalityError extends Error {
  constructor(found: readonly string[]) {
    const where = found.length > 0 ? ` (${found.join(', ')})` : ''
    super(`expected exactly one participant with eligibility "generalist", found ${found.length}${where}`)
    this.name = 'GeneralistCardinalityError'
  }
}

export function requireDistinctRoles(roles: readonly RoleDefinition[]): readonly RoleDefinition[] {
  const seenIds = new Set<string>()
  const seenHandles = new Set<string>()
  for (const role of roles) {
    if (seenIds.has(role.id)) {
      throw new ShippedDataError('the shipped participants', role.id, `duplicate participant id "${role.id}"`)
    }
    if (seenHandles.has(role.handle)) {
      throw new ShippedDataError('the shipped participants', role.id, `duplicate handle "${role.handle}"`)
    }
    seenIds.add(role.id)
    seenHandles.add(role.handle)
  }

  return roles
}

export function requireSingleGeneralist(roles: readonly RoleDefinition[]): RoleDefinition {
  const generalists = roles.filter((role) => role.eligibility === 'generalist')
  const [generalist, ...rest] = generalists
  if (generalist === undefined || rest.length > 0) {
    throw new GeneralistCardinalityError(generalists.map((role) => role.id))
  }
  return generalist
}

export function requireValidAvailability(roles: readonly RoleDefinition[], modeIds: ReadonlySet<string>): readonly RoleDefinition[] {
  for (const role of roles) {
    if (role.eligibility !== 'cast' && role.availability.length > 0) {
      throw new ShippedDataError('the shipped participants', role.id, 'only a cast participant may declare availability')
    }

    const seen = new Set<string>()
    for (const entry of role.availability) {
      if (!modeIds.has(entry.mode)) {
        throw new ShippedDataError('the shipped participants', role.id, `availability names mode "${entry.mode}", which did not load`)
      }
      const key = `${entry.mode}:${entry.surface}`
      if (seen.has(key)) {
        throw new ShippedDataError(
          'the shipped participants',
          role.id,
          `duplicate availability for mode "${entry.mode}" and surface "${entry.surface}"`,
        )
      }
      seen.add(key)
    }
  }

  return roles
}

export function loadRoles(contentRoot: string, modeIds: ReadonlySet<string>): readonly RoleDefinition[] {
  const roles = requireDistinctRoles(readShippedParticipants(contentRoot, participantFrontmatterSchema))
  requireSingleGeneralist(roles)
  requireValidAvailability(roles, modeIds)
  return roles
}
