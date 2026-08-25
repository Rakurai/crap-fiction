import { z } from 'zod'

export const modeSummarySchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
  })
  .readonly()
export type ModeSummary = z.infer<typeof modeSummarySchema>
