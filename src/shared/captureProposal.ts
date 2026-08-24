import { z } from 'zod'

/**
 * CONTEXT "Capture context": a proposal belongs to one durable context —
 * story context, which belongs to this piece, or author context, which
 * generalizes beyond it.
 */
export const captureDestinationSchema = z.enum(['authorContext', 'storyContext'])

export type CaptureDestination = z.infer<typeof captureDestinationSchema>

/** CONTEXT "Capture context": "add, revise, replace a statement that no longer holds, or remove something no longer true". */
export const captureOperationSchema = z.enum(['add', 'revise', 'replace', 'remove'])

export type CaptureOperation = z.infer<typeof captureOperationSchema>

const captureProposalFieldsSchema = z.object({
  destination: captureDestinationSchema,
  /** The durable context's own section name — the author's, not a closed set (`durableContextSchema`). */
  section: z.string().min(1),
  operation: captureOperationSchema,
  /** The existing entry this proposal concerns, quoted exactly as it stands — present for every operation but `add`, which concerns nothing existing. */
  entry: z.string().min(1).optional(),
  /** The proposed text — present for every operation but `remove`, which proposes no replacement. */
  text: z.string().min(1).optional(),
})

/**
 * SPEC "Model access": the shape a local model has to hold, so the two
 * exceptions to "every field present" are asserted once rather than left for
 * whatever reads a proposal to assume.
 */
function checkProposalFields(value: { operation: CaptureOperation; entry?: string | undefined; text?: string | undefined }, ctx: z.RefinementCtx): void {
  if (value.operation !== 'add' && value.entry === undefined) {
    ctx.addIssue({ code: 'custom', message: 'revise, replace and remove name the entry they concern', path: ['entry'] })
  }
  if (value.operation !== 'remove' && value.text === undefined) {
    ctx.addIssue({ code: 'custom', message: 'add, revise and replace propose text', path: ['text'] })
  }
}

/** One proposal as the model states it — CONTEXT "Capture context"'s whole shape, before the review gives it an identity. */
export const captureProposalValueSchema = captureProposalFieldsSchema.superRefine(checkProposalFields)

export type CaptureProposalValue = z.infer<typeof captureProposalValueSchema>

/**
 * SPEC "Model access": "context capture returning many proposals is the one
 * case" a schema is shaped for several — wrapped once in an object because a
 * bare top-level array is not a shape every runtime's constrained decoding
 * accepts.
 */
export const captureResultSchema = z.object({ proposals: z.array(captureProposalValueSchema) })

export type CaptureResult = z.infer<typeof captureResultSchema>

/** A proposal as the review holds it and the wire carries it — the model's value plus the identity approving or ignoring it needs. */
export const captureProposalSchema = captureProposalFieldsSchema.extend({ id: z.string().min(1) }).superRefine(checkProposalFields)

export type CaptureProposal = Readonly<z.infer<typeof captureProposalSchema>>

/**
 * SPEC "Context capture": "each destination is its own write... where one
 * fails, the review stays open with the failure stated and its proposals
 * still approved, and retrying writes only the destination that failed."
 */
export const captureApproveOutcomeSchema = z.object({
  written: z.array(captureDestinationSchema),
  failures: z.array(z.object({ destination: captureDestinationSchema, message: z.string() })),
})

export type CaptureApproveOutcome = z.infer<typeof captureApproveOutcomeSchema>
