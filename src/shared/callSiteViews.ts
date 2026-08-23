import { z } from 'zod'

/**
 * A call site and the model assigned to it, as the interface receives it.
 * Absence has one representation over the wire (CODING_STANDARDS "HTTP
 * layer"): `null`, matching the workspace and theme boundaries, rather than
 * an `undefined` field JSON drops silently.
 */
export const callSiteAssignmentViewSchema = z
  .object({
    site: z.string(),
    displayName: z.string().nullable(),
    roleDescription: z.string().nullable(),
    assignment: z.string().nullable(),
  })
  .readonly()

export type CallSiteAssignmentView = z.infer<typeof callSiteAssignmentViewSchema>
