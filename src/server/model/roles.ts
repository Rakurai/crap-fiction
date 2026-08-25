import { z } from 'zod'
import { handlePattern } from '../../shared/handle.js'
import { readShippedParticipants, ShippedDataError } from '../store/index.js'

const participantFrontmatterSchema = z.object({
  handle: z.string().regex(handlePattern, 'must be one lowercase token, distinct from the display name'),
  displayName: z.string().min(1),
  description: z.string().min(1),
})

export type RoleDefinition = Readonly<{
  id: string
  handle: string
  displayName: string
  description: string
  persona: string
}>

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

export function loadRoles(contentRoot: string): readonly RoleDefinition[] {
  return requireDistinctRoles(readShippedParticipants(contentRoot, participantFrontmatterSchema))
}
