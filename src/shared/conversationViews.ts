import { z } from 'zod'
import { appliedChangeSchema } from './appliedChange.js'
import { failureReasonSchema } from './modelResult.js'

// Two members share `kind: 'response'`, so `discriminatedUnion` cannot express this.
export const participantResultSchema = z.union([
  z.object({ kind: z.literal('response'), outcome: z.literal('noComment') }),
  z.object({
    kind: z.literal('response'),
    outcome: z.enum(['commentary', 'applicableSuggestion']),
    claim: z.string().min(1),
    note: z.string().min(1).optional(),
  }),
  z.object({ kind: z.literal('failed'), reason: failureReasonSchema, returned: z.string().optional() }),
  z.object({ kind: z.literal('abandoned') }),
])

export type ParticipantResult = z.infer<typeof participantResultSchema>

export type SubstantiveResponse = Extract<ParticipantResult, { kind: 'response'; outcome: 'commentary' | 'applicableSuggestion' }>

export function substantiveResponse(result: ParticipantResult): SubstantiveResponse | undefined {
  return result.kind === 'response' && result.outcome !== 'noComment' ? result : undefined
}

export const roundParticipantRecordSchema = z.object({
  participantId: z.string().min(1),
  result: participantResultSchema,
})

export type RoundParticipantRecord = z.infer<typeof roundParticipantRecordSchema>

export const respondingToSchema = z.object({ roundId: z.string().min(1), participantId: z.string().min(1) })

export type RespondingTo = z.infer<typeof respondingToSchema>

export const roundRecordSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1).optional(),
  addressed: z.array(z.string().min(1)).readonly(),
  brought: z.array(z.string().min(1)).readonly(),
  respondingTo: respondingToSchema.optional(),
  clarification: z.string().min(1).optional(),
  participants: z.array(roundParticipantRecordSchema).readonly(),
  outcome: z.enum(['settled', 'abandoned']),
})

export type RoundRecord = z.infer<typeof roundRecordSchema>

export const conversationSchema = z.object({
  id: z.string().min(1),
  rounds: z.array(roundRecordSchema).readonly(),
})

export type Conversation = z.infer<typeof conversationSchema>

export const roundParticipantViewSchema = roundParticipantRecordSchema.extend({
  appliedChanges: z.array(appliedChangeSchema).readonly(),
})

export type RoundParticipantView = z.infer<typeof roundParticipantViewSchema>

export const roundViewSchema = roundRecordSchema.extend({
  participants: z.array(roundParticipantViewSchema).readonly(),
})

export type RoundView = z.infer<typeof roundViewSchema>

export const conversationViewSchema = z.object({
  id: z.string().min(1),
  rounds: z.array(roundViewSchema).readonly(),
})

export type ConversationView = z.infer<typeof conversationViewSchema>

export const conversationSummarySchema = z
  .object({
    id: z.string().min(1),
    opening: z.string().min(1).optional(),
    lastActivity: z.number(),
  })
  .readonly()

export type ConversationSummary = z.infer<typeof conversationSummarySchema>
