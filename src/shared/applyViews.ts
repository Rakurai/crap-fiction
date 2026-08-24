import { z } from 'zod'
import { appliedChangeSchema } from './appliedChange.js'
import { failureReasonSchema } from './modelResult.js'

export const applyOutcomeSchema = z.union([
  z.object({ outcome: z.literal('applied'), manuscript: z.string().min(1), change: appliedChangeSchema.optional() }),
  z.object({ outcome: z.literal('failed'), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('abandoned') }),
])

export type ApplyOutcome = z.infer<typeof applyOutcomeSchema>
