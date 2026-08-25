import { z } from 'zod'
import { captureProposalSchema } from './captureProposal.js'
import { failureReasonSchema } from './modelResult.js'

export const captureOutcomeSchema = z.union([
  z.object({ outcome: z.literal('captured'), proposals: z.array(captureProposalSchema) }),
  z.object({ outcome: z.literal('failed'), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ outcome: z.literal('abandoned') }),
])

export type CaptureOutcome = z.infer<typeof captureOutcomeSchema>

export const captureSnapshotSchema = z.object({
  conversationId: z.string().min(1),
  openedAt: z.number().int().positive(),
})

export type CaptureSnapshot = z.infer<typeof captureSnapshotSchema>
