import { z } from 'zod'
import { handlePattern } from '../../shared/handle.js'
import { readShippedParticipants, ShippedDataError } from '../store/index.js'

const eligibilitySchema = z.enum(['cast', 'generalist', 'addressed-only'])

export type Eligibility = z.infer<typeof eligibilitySchema>

const participantFrontmatterSchema = z.object({
  handle: z.string().regex(handlePattern, 'must be one lowercase token, distinct from the display name'),
  displayName: z.string().min(1),
  description: z.string().min(1),
  eligibility: eligibilitySchema,
})

export type RoleDefinition = Readonly<{
  id: string
  handle: string
  displayName: string
  description: string
  persona: string
  eligibility: Eligibility
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

export function loadRoles(contentRoot: string): readonly RoleDefinition[] {
  const roles = requireDistinctRoles(readShippedParticipants(contentRoot, participantFrontmatterSchema))
  requireSingleGeneralist(roles)
  return roles
}
