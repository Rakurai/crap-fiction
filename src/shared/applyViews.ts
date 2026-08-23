import { z } from 'zod'
import { failureReasonSchema } from './modelResult.js'

/**
 * SPEC "Transport": `POST .../apply`'s own answer, reached by the request that
 * asked for it rather than by an event — there is no round to open and
 * nothing here calls a participant. The same taxonomy `CallResult` states at
 * the model seam, restated at the wire the client actually reads: a settled
 * call carries the manuscript it produced, an abandoned one carries nothing
 * (CONTEXT "Apply": identical to the author's eye), and a failed one carries
 * what the model layer already knows to say about a call that did not land.
 */
export const applyOutcomeSchema = z.union([
  z.object({ outcome: z.literal('applied'), manuscript: z.string().min(1) }),
  z.object({ outcome: z.literal('failed'), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('abandoned') }),
])

export type ApplyOutcome = z.infer<typeof applyOutcomeSchema>
