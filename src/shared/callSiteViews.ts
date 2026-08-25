import { z } from 'zod'

export const callSiteAssignmentViewSchema = z
  .object({
    site: z.string(),
    handle: z.string().nullable(),
    displayName: z.string(),
    description: z.string(),
    assignment: z.string().nullable(),
  })
  .readonly()

export type CallSiteAssignmentView = z.infer<typeof callSiteAssignmentViewSchema>
