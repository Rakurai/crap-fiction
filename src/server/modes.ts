import { z } from 'zod'
import { readYamlDirectory, ShippedDataError } from './store.js'

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
 *
 * PRD "Choose the form": with one form implemented, the author is shown the
 * form rather than asked to choose it — a fact settled here, once, rather
 * than by a route picking the first descriptor it finds. A roster that does
 * not resolve to exactly one mode is a startup failure naming what was
 * wrong, not a value a request-handling route invents.
 */
export function loadModes(dir: string): ModeDescriptor {
  const modes = readYamlDirectory(dir, modeSchema)
  const [mode] = modes
  if (modes.length !== 1 || mode === undefined) {
    throw new ShippedDataError(dir, '(directory)', `expected exactly one mode, found ${modes.length}`)
  }
  return mode
}
