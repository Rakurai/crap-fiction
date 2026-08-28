import { z } from 'zod'

export const replacementSchema = z.string().min(1)

export type Replacement = z.infer<typeof replacementSchema>

export const applyResultSchema = z.object({ replacement: replacementSchema })

export type ApplyResult = z.infer<typeof applyResultSchema>
