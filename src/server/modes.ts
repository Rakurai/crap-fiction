import { z } from 'zod'
import { readShippedModes } from './store/index.js'

const modeSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
})

export type ModeDescriptor = Readonly<{
  id: string
  displayName: string
  description: string
}>

export function loadModes(): readonly ModeDescriptor[] {
  return readShippedModes(modeSchema)
}
