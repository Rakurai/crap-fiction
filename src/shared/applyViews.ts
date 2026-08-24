import { z } from 'zod'
import { appliedChangeSchema } from './appliedChange.js'
import { failureReasonSchema } from './modelResult.js'

/**
 * SPEC "Transport": `POST .../apply`'s own answer, reached by the request that
 * asked for it rather than by an event — there is no round to open and
 * nothing here calls a participant. The same taxonomy `CallResult` states at
 * the model seam, restated at the wire the client actually reads: a settled
 * call carries the manuscript it produced, an abandoned one carries nothing
 * (CONTEXT "Apply": identical to the author's eye), and a failed one carries
 * what the model layer already knows to say about a call that did not land.
 *
 * `change` is absent rather than an empty change where the manuscript the
 * call returned is identical to the draft it started from — there is nothing
 * an application changed to keep a record of.
 */
export const applyOutcomeSchema = z.union([
  z.object({ outcome: z.literal('applied'), manuscript: z.string().min(1), change: appliedChangeSchema.optional() }),
  z.object({ outcome: z.literal('failed'), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('abandoned') }),
])

export type ApplyOutcome = z.infer<typeof applyOutcomeSchema>
