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

export function selectSingleMode(modes: readonly ModeDescriptor[]): ModeDescriptor {
  const [mode] = modes
  if (modes.length !== 1 || mode === undefined) {
    throw new ShippedDataError('the shipped modes', '(roster)', `expected exactly one mode, found ${modes.length}`)
  }
  return mode
}

export function loadModes(): ModeDescriptor {
  return selectSingleMode(readShippedModes(modeSchema))
}
