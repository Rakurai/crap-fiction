import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'

export class InvalidCharterDataError extends Error {
  constructor(file: string, entry: string, reason: string) {
    super(`${file}: ${entry}: ${reason}`)
    this.name = 'InvalidCharterDataError'
  }
}

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
 * The participant charter is this roster as a whole, validated strictly:
 * the author never hand-edits shipped data, so no tolerance applies, and
 * invalid shipped data is a startup failure (CODING_STANDARDS "Fail fast")
 * rather than a room with the wrong cast.
 */
export function loadCharter(dir: string): readonly RoleDefinition[] {
  const files = readdirSync(dir).filter((name) => name.endsWith('.yaml'))
  const charter = files.map((name) => {
    const filePath = path.join(dir, name)
    const raw = parse(readFileSync(filePath, 'utf8'))
    const result = roleDefinitionSchema.safeParse(raw)
    if (!result.success) {
      const issue = result.error.issues[0]
      const entry = issue !== undefined && issue.path.length > 0 ? issue.path.join('.') : '(document)'
      throw new InvalidCharterDataError(filePath, entry, issue?.message ?? 'invalid value')
    }
    return result.data
  })

  if (charter.length === 0) {
    throw new InvalidCharterDataError(dir, '(directory)', 'no role definitions found')
  }

  const seenIds = new Set<string>()
  const seenHandles = new Set<string>()
  for (const role of charter) {
    if (seenIds.has(role.id)) {
      throw new InvalidCharterDataError(dir, role.id, `duplicate participant id "${role.id}"`)
    }
    if (seenHandles.has(role.handle)) {
      throw new InvalidCharterDataError(dir, role.id, `duplicate handle "${role.handle}"`)
    }
    seenIds.add(role.id)
    seenHandles.add(role.handle)
  }

  return charter
}
