import { z } from 'zod'

export const responseOutcomeSchema = z.enum(['noComment', 'commentary', 'applicableSuggestion'])

export type ResponseOutcome = z.infer<typeof responseOutcomeSchema>

// The claim is required and trimmed at the grammar itself — `z.toJSONSchema` carries `minLength`
// into guided decoding, and `safeParse` enforces it on every runtime whether or not decoding is
// guided there. A response missing it does not conform, and the model module retries and then
// fails it rather than this module inventing a claim from the note.
const substantiveValueSchema = z.object({
  outcome: z.enum(['commentary', 'applicableSuggestion']),
  claim: z.string().trim().min(1),
  note: z.string().optional(),
})

const noCommentValueSchema = z.object({ outcome: z.literal('noComment') })

export const eligibleResponseValueSchema = z.union([noCommentValueSchema, substantiveValueSchema])

export const owedResponseValueSchema = substantiveValueSchema

export type ResponseValue = z.infer<typeof eligibleResponseValueSchema>

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

export function normalizeResponse(value: ResponseValue): NormalizedResponse {
  if (value.outcome === 'noComment') return { outcome: 'noComment' }
  return { outcome: value.outcome, claim: value.claim, note: said(value.note) }
}
