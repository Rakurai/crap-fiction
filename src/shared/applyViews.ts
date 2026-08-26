import { z } from 'zod'
import { appliedChangeContentSchema } from './appliedChange.js'
import { failureReasonSchema } from './modelResult.js'

/**
 * What starting an Apply answers with: a no-change result settles immediately, a replacement
 * is only pending until the client installs, saves and confirms it.
 */
export const applyOutcomeSchema = z.union([
  z.object({ outcome: z.literal('noChange'), actionId: z.string().min(1) }),
  z.object({ outcome: z.literal('pending'), actionId: z.string().min(1), applicationId: z.string().min(1), manuscript: z.string().min(1) }),
  z.object({ outcome: z.literal('failed'), actionId: z.string().min(1), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('abandoned'), actionId: z.string().min(1) }),
])

export type ApplyOutcome = z.infer<typeof applyOutcomeSchema>

/** What confirming a pending Apply answers with, once the store has verified and committed it. */
export const applyConfirmationSchema = z.object({
  entryId: z.string().min(1),
  change: appliedChangeContentSchema,
})

export type ApplyConfirmation = z.infer<typeof applyConfirmationSchema>
