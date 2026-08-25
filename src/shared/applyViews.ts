import { z } from 'zod'
import { appliedChangeSchema } from './appliedChange.js'
import { failureReasonSchema } from './modelResult.js'

export const applyOutcomeSchema = z.union([
  z.object({
    outcome: z.literal('applied'),
    actionId: z.string().min(1),
    manuscript: z.string().min(1),
    change: appliedChangeSchema.optional(),
    entryId: z.string().min(1).optional(),
  }),
  z.object({ outcome: z.literal('failed'), actionId: z.string().min(1), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('abandoned'), actionId: z.string().min(1) }),
])

export type ApplyOutcome = z.infer<typeof applyOutcomeSchema>
