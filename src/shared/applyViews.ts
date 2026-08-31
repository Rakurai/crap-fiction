import { z } from 'zod'
import { appliedChangeContentSchema } from './appliedChange.js'
import { replacementSchema } from './applyResult.js'
import { failureReasonSchema } from './modelResult.js'

export const INAPPLICABLE = 'inapplicable'

const applyFailureReasonSchema = z.enum([...failureReasonSchema.options, INAPPLICABLE] as const)

export type ApplyFailureReason = z.infer<typeof applyFailureReasonSchema>

export const applyOutcomeSchema = z.union([
  z.object({ outcome: z.literal('noChange'), actionId: z.string().min(1) }),
  z.object({ outcome: z.literal('pending'), actionId: z.string().min(1), applicationId: z.string().min(1), replacement: replacementSchema }),
  z.object({ outcome: z.literal('failed'), actionId: z.string().min(1), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('failed'), actionId: z.string().min(1), reason: z.literal(INAPPLICABLE) }),
  z.object({ outcome: z.literal('abandoned'), actionId: z.string().min(1) }),
])

export type ApplyOutcome = z.infer<typeof applyOutcomeSchema>

export const applyConfirmationSchema = z.object({
  entryId: z.string().min(1),
  change: appliedChangeContentSchema,
})

export type ApplyConfirmation = z.infer<typeof applyConfirmationSchema>
