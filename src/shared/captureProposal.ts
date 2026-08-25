import { z } from 'zod'

export const captureDestinationSchema = z.enum(['authorContext', 'storyContext'])

export type CaptureDestination = z.infer<typeof captureDestinationSchema>

export const captureOperationSchema = z.enum(['add', 'revise', 'replace', 'remove'])

export type CaptureOperation = z.infer<typeof captureOperationSchema>

const common = { destination: captureDestinationSchema, section: z.string().min(1) }

function proposalBranches<Extra extends z.ZodRawShape>(extra: Extra) {
  return [
    z.object({ ...common, ...extra, operation: z.literal('add'), text: z.string().min(1) }),
    z.object({ ...common, ...extra, operation: z.literal('revise'), entry: z.string().min(1), text: z.string().min(1) }),
    z.object({ ...common, ...extra, operation: z.literal('replace'), entry: z.string().min(1), text: z.string().min(1) }),
    z.object({ ...common, ...extra, operation: z.literal('remove'), entry: z.string().min(1) }),
  ] as const
}

export const captureProposalValueSchema = z.discriminatedUnion('operation', proposalBranches({}))

export type CaptureProposalValue = z.infer<typeof captureProposalValueSchema>

export const captureResultSchema = z.object({ proposals: z.array(captureProposalValueSchema) })

export type CaptureResult = z.infer<typeof captureResultSchema>

export const captureProposalSchema = z.discriminatedUnion('operation', proposalBranches({ id: z.string().min(1) }))

export type CaptureProposal = Readonly<z.infer<typeof captureProposalSchema>>

export const captureApproveOutcomeSchema = z.object({
  written: z.array(captureDestinationSchema),
  failures: z.array(z.object({ destination: captureDestinationSchema, message: z.string() })),
})

export type CaptureApproveOutcome = z.infer<typeof captureApproveOutcomeSchema>
