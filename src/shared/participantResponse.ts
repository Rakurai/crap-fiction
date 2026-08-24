import { z } from 'zod'

export const responseOutcomeSchema = z.enum(['noComment', 'commentary', 'applicableSuggestion'])

export type ResponseOutcome = z.infer<typeof responseOutcomeSchema>

export const eligibleResponseValueSchema = z
  .object({
    outcome: responseOutcomeSchema,
    claim: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .refine((value) => value.outcome === 'noComment' || value.claim !== undefined, {
    message: 'a response that says anything states a claim',
    path: ['claim'],
  })

export type EligibleResponseValue = z.infer<typeof eligibleResponseValueSchema>

export const owedResponseValueSchema = z.object({
  outcome: z.enum(['commentary', 'applicableSuggestion']),
  claim: z.string().min(1),
  note: z.string().min(1).optional(),
})

export type OwedResponseValue = z.infer<typeof owedResponseValueSchema>

export function responseValueSchema(owesAnswer: boolean) {
  return owesAnswer ? owedResponseValueSchema : eligibleResponseValueSchema
}
