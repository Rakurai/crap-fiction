import { z } from 'zod'
import { captureProposalSchema } from './captureProposal.js'
import { failureReasonSchema } from './modelResult.js'

/**
 * SPEC "Transport": `POST .../capture`'s own answer, reached by the request
 * that asked for it rather than by an event — the same `CallResult` taxonomy
 * `applyOutcomeSchema` restates at the wire, with the model's proposals in
 * place of a manuscript.
 */
export const captureOutcomeSchema = z.union([
  z.object({ outcome: z.literal('captured'), proposals: z.array(captureProposalSchema) }),
  z.object({ outcome: z.literal('failed'), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('abandoned') }),
])

export type CaptureOutcome = z.infer<typeof captureOutcomeSchema>
