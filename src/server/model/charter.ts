import { z } from 'zod'
import { readYamlDirectory, ShippedDataError } from '../store.js'

const roleDefinitionSchema = z.object({
  id: z.string().min(1),
  handle: z
    .string()
    .regex(/^[a-z][a-z0-9]*$/, 'must be one lowercase token, distinct from the display name'),
  displayName: z.string().min(1),
  roleDescription: z.string().min(1),
})

export type RoleDefinition = Readonly<z.infer<typeof roleDefinitionSchema>>

/**
 * SPEC "Files": role definitions are shipped data, carrying a participant's
 * display name and its single-token handle — different things, since a
 * multi-word display name cannot be recovered from an addressed message.
 * The participant charter is this roster as a whole, read through the
 * store's shared shipped-data loader: the author never hand-edits shipped
 * data, so no tolerance applies, and invalid shipped data is a startup
 * failure (CODING_STANDARDS "Fail fast") rather than a room with the wrong
 * cast.
 */
export function loadCharter(dir: string): readonly RoleDefinition[] {
  const charter = readYamlDirectory(dir, roleDefinitionSchema)

  const seenIds = new Set<string>()
  const seenHandles = new Set<string>()
  for (const role of charter) {
    if (seenIds.has(role.id)) {
      throw new ShippedDataError(dir, role.id, `duplicate participant id "${role.id}"`)
    }
    if (seenHandles.has(role.handle)) {
      throw new ShippedDataError(dir, role.id, `duplicate handle "${role.handle}"`)
    }
    seenIds.add(role.id)
    seenHandles.add(role.handle)
  }

  return charter
}
