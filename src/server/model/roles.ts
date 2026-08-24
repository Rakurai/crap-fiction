import { z } from 'zod'
import { readShippedRoles, ShippedDataError } from '../store/index.js'

const roleDefinitionSchema = z.object({
  id: z.string().min(1),
  handle: z
    .string()
    .regex(/^[a-z][a-z0-9]*$/, 'must be one lowercase token, distinct from the display name'),
  displayName: z.string().min(1),
  roleDescription: z.string().min(1),
})

export type RoleDefinition = Readonly<z.infer<typeof roleDefinitionSchema>>

export function requireDistinctRoles(roles: readonly RoleDefinition[]): readonly RoleDefinition[] {
  const seenIds = new Set<string>()
  const seenHandles = new Set<string>()
  for (const role of roles) {
    if (seenIds.has(role.id)) {
      throw new ShippedDataError('the shipped roles', role.id, `duplicate participant id "${role.id}"`)
    }
    if (seenHandles.has(role.handle)) {
      throw new ShippedDataError('the shipped roles', role.id, `duplicate handle "${role.handle}"`)
    }
    seenIds.add(role.id)
    seenHandles.add(role.handle)
  }

  return roles
}

export function loadRoles(): readonly RoleDefinition[] {
  return requireDistinctRoles(readShippedRoles(roleDefinitionSchema))
}
