import { z } from 'zod'
import { readShippedModes, ShippedDataError } from './store/index.js'

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
 * PRD "Choose the form": with one form implemented, the author is shown the
 * form rather than asked to choose it — a fact settled here, once, rather
 * than by a route picking the first descriptor it finds. A roster that does
 * not resolve to exactly one mode is a startup failure naming what was
 * wrong, not a value a request-handling route invents.
 */
export function selectSingleMode(modes: readonly ModeDescriptor[]): ModeDescriptor {
  const [mode] = modes
  if (modes.length !== 1 || mode === undefined) {
    throw new ShippedDataError('the shipped modes', '(roster)', `expected exactly one mode, found ${modes.length}`)
  }
  return mode
}

/**
 * Mode descriptors are shipped data (CONTEXT "Mode": a mode supplies the
 * default cast and the criteria each specialist applies at that scale). This
 * states what a mode must contain; where the files are is the store's, and the
 * author never hand-edits shipped data, so no tolerance applies and anything
 * invalid is a startup failure (SPEC "Files") rather than a degraded mode.
 */
export function loadModes(): ModeDescriptor {
  return selectSingleMode(readShippedModes(modeSchema))
}
