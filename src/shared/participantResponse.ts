import { z } from 'zod'

export const responseOutcomeSchema = z.enum(['noComment', 'commentary', 'applicableSuggestion'])

export type ResponseOutcome = z.infer<typeof responseOutcomeSchema>

// Guided decoding is driven by `z.toJSONSchema`, which carries neither a refinement nor a minimum
// length, so no wire schema can oblige a runtime to write a claim. Both fields are optional here
// and the requirement is applied by `normalizeResponse`.
const responseWireSchema = z.object({
  outcome: responseOutcomeSchema,
  claim: z.string().optional(),
  note: z.string().optional(),
})

export const eligibleResponseValueSchema = responseWireSchema

export const owedResponseValueSchema = responseWireSchema.extend({
  outcome: z.enum(['commentary', 'applicableSuggestion']),
})

export type ResponseValue = z.infer<typeof responseWireSchema>

export function responseValueSchema(owesAnswer: boolean) {
  return owesAnswer ? owedResponseValueSchema : eligibleResponseValueSchema
}

export type NormalizedResponse =
  | Readonly<{ outcome: 'noComment' }>
  | Readonly<{ outcome: 'commentary' | 'applicableSuggestion'; claim: string; note: string | undefined }>

function said(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const trimmed = text.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

export function normalizeResponse(value: ResponseValue): NormalizedResponse | undefined {
  if (value.outcome === 'noComment') return { outcome: 'noComment' }

  const claim = said(value.claim)
  const note = said(value.note)
  if (claim === undefined) return note === undefined ? undefined : { outcome: value.outcome, claim: note, note: undefined }
  return { outcome: value.outcome, claim, note }
}
