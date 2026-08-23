import { z } from 'zod'

/**
 * CONTEXT "Response": every response settles as exactly one of three
 * outcomes, declared by the participant itself.
 */
export const responseOutcomeSchema = z.enum(['noComment', 'commentary', 'applicableSuggestion'])

export type ResponseOutcome = z.infer<typeof responseOutcomeSchema>

/**
 * CONTEXT "Response": a response that says anything states a claim, and its
 * note is optional elaboration; no comment says nothing at all, so it carries
 * neither. SPEC "Model access": three flat fields, because that is what
 * constrained decoding holds reliably against a local model.
 *
 * This is the shape offered to a round that named no one — a call the
 * participant is merely eligible for, so silence is on the table.
 */
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

/**
 * SPEC "Model access": a call that owes an answer has no no-comment outcome
 * in its schema — an addressed participant, or the Story Editor on a round
 * where nothing substantive landed.
 */
export const owedResponseValueSchema = z.object({
  outcome: z.enum(['commentary', 'applicableSuggestion']),
  claim: z.string().min(1),
  note: z.string().min(1).optional(),
})

export type OwedResponseValue = z.infer<typeof owedResponseValueSchema>

export function responseValueSchema(owesAnswer: boolean) {
  return owesAnswer ? owedResponseValueSchema : eligibleResponseValueSchema
}
