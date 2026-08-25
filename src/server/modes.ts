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
  storyContextReference: string
}>

export function loadModes(contentRoot: string): readonly ModeDescriptor[] {
  return readShippedModes(contentRoot, modeSchema)
}
