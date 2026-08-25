import { z } from 'zod'
import { readShippedModes, ShippedDataError } from './store/index.js'

const modeSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
})

export type ModeDescriptor = Readonly<{
  id: string
  displayName: string
  description: string
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
