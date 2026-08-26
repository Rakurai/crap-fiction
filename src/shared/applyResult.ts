import { z } from 'zod'

export const applyResultSchema = z.object({ replacement: z.string().min(1) })

export type ApplyResult = z.infer<typeof applyResultSchema>
