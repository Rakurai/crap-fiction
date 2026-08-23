import { z } from 'zod'
import { readYamlDirectory } from './store.js'

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
 * Every `.yaml` file in `dir` is one mode, read through the store's shared
 * shipped-data loader: the author never hand-edits shipped data, so no
 * tolerance applies, and invalid shipped data is a startup failure (SPEC
 * "Files") rather than a degraded mode.
 */
export function loadModes(dir: string): readonly ModeDescriptor[] {
  return readYamlDirectory(dir, modeSchema)
}
