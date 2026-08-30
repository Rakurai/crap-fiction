import { z } from 'zod'

export const responseOutcomeSchema = z.enum(['noComment', 'commentary', 'applicableSuggestion'])

export type ResponseOutcome = z.infer<typeof responseOutcomeSchema>

export const substantiveOutcomeSchema = responseOutcomeSchema.exclude(['noComment'])

export type SubstantiveOutcome = z.infer<typeof substantiveOutcomeSchema>

export const noCommentOutcomeSchema = responseOutcomeSchema.extract(['noComment'])

const substantiveValueSchema = z.object({
  outcome: substantiveOutcomeSchema,
  claim: z.string().min(1),
  note: z.string().optional(),
})

const noCommentValueSchema = z.object({ outcome: noCommentOutcomeSchema })

export const eligibleResponseValueSchema = z.union([noCommentValueSchema, substantiveValueSchema])

export const owedResponseValueSchema = substantiveValueSchema

export type ResponseValue = z.infer<typeof eligibleResponseValueSchema>

export type ResponseValueSchema = typeof owedResponseValueSchema | typeof eligibleResponseValueSchema

export function responseValueSchema(owesAnswer: boolean): ResponseValueSchema {
  return owesAnswer ? owedResponseValueSchema : eligibleResponseValueSchema
}
