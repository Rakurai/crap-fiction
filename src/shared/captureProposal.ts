import { z } from 'zod'

export const captureDestinationSchema = z.enum(['authorContext', 'storyContext'])

export type CaptureDestination = z.infer<typeof captureDestinationSchema>

export const captureOperationSchema = z.enum(['add', 'revise', 'replace', 'remove'])

export type CaptureOperation = z.infer<typeof captureOperationSchema>

const captureProposalFieldsSchema = z.object({
  destination: captureDestinationSchema,
  section: z.string().min(1),
  operation: captureOperationSchema,
  entry: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
})

function checkProposalFields(value: { operation: CaptureOperation; entry?: string | undefined; text?: string | undefined }, ctx: z.RefinementCtx): void {
  if (value.operation !== 'add' && value.entry === undefined) {
    ctx.addIssue({ code: 'custom', message: 'revise, replace and remove name the entry they concern', path: ['entry'] })
  }
  if (value.operation !== 'remove' && value.text === undefined) {
    ctx.addIssue({ code: 'custom', message: 'add, revise and replace propose text', path: ['text'] })
  }
}

export const captureProposalValueSchema = captureProposalFieldsSchema.superRefine(checkProposalFields)

export type CaptureProposalValue = z.infer<typeof captureProposalValueSchema>

export const captureResultSchema = z.object({ proposals: z.array(captureProposalValueSchema) })

export type CaptureResult = z.infer<typeof captureResultSchema>

export const captureProposalSchema = captureProposalFieldsSchema.extend({ id: z.string().min(1) }).superRefine(checkProposalFields)

export type CaptureProposal = Readonly<z.infer<typeof captureProposalSchema>>

export const captureApproveOutcomeSchema = z.object({
  written: z.array(captureDestinationSchema),
  failures: z.array(z.object({ destination: captureDestinationSchema, message: z.string() })),
})

export type CaptureApproveOutcome = z.infer<typeof captureApproveOutcomeSchema>
