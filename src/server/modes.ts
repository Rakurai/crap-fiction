import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'

export class InvalidModeDataError extends Error {
  constructor(file: string, entry: string, reason: string) {
    super(`${file}: ${entry}: ${reason}`)
    this.name = 'InvalidModeDataError'
  }
}

const modeSpecialistSchema = z.object({
  id: z.string().min(1),
  attendsTo: z.string().min(1),
  defect: z.string().min(1),
})

const modeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cast: z.array(modeSpecialistSchema).min(1),
})

export type ModeSpecialist = Readonly<z.infer<typeof modeSpecialistSchema>>

export type ModeDescriptor = Readonly<{
  id: string
  name: string
  cast: readonly ModeSpecialist[]
}>

/**
 * Mode descriptors are shipped data (CONTEXT "Mode": a mode supplies the
 * default cast and the criteria each specialist applies at that scale).
 * Every `.yaml` file in `dir` is one mode. They are validated strictly,
 * unlike store.ts's tolerant reader for author-edited files: the author
 * never hand-edits shipped data, so no tolerance applies, and invalid
 * shipped data is a startup failure (SPEC "Files") rather than a degraded
 * mode.
 */
export function loadModes(dir: string): readonly ModeDescriptor[] {
  const files = readdirSync(dir).filter((name) => name.endsWith('.yaml'))
  const modes = files.map((name) => {
    const filePath = path.join(dir, name)
    const raw = parse(readFileSync(filePath, 'utf8'))
    const result = modeSchema.safeParse(raw)
    if (!result.success) {
      const issue = result.error.issues[0]
      const entry = issue !== undefined && issue.path.length > 0 ? issue.path.join('.') : '(document)'
      throw new InvalidModeDataError(filePath, entry, issue?.message ?? 'invalid value')
    }
    return result.data
  })

  if (modes.length === 0) {
    throw new InvalidModeDataError(dir, '(directory)', 'no mode descriptors found')
  }

  return modes
}
