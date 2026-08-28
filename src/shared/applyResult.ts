import { z } from 'zod'

export const replacementSchema = z.string()

export type Replacement = z.infer<typeof replacementSchema>

export const editSchema = z.object({
  find: z.string(),
  replace: replacementSchema,
  occurrence: z.number().int().nonnegative().optional(),
})

export type Edit = z.infer<typeof editSchema>

export const applyResultSchema = z.object({ edits: z.array(editSchema).min(1) })

export type ApplyResult = z.infer<typeof applyResultSchema>
