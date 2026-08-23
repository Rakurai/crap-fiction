import { z } from 'zod'
import { failureReasonSchema } from './modelResult.js'

/**
 * What one participant returned for one round, over the wire and on disk.
 * CONTEXT "Response"/"Round": a no-comment outcome carries neither claim nor
 * note; failure, silence and abandonment are ordinary and distinct from one
 * another, never collapsed into a missing value.
 */
/**
 * `z.union` rather than `z.discriminatedUnion`: two of these members share
 * `kind: 'response'`, discriminated further by `outcome`, and
 * `discriminatedUnion` requires one discriminator value per member. A plain
 * union validates the same shapes; TypeScript still narrows on `kind` and
 * `outcome` in the inferred type regardless of which zod combinator produced it.
 */
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

export const roundParticipantRecordSchema = z.object({
  participantId: z.string().min(1),
  result: participantResultSchema,
})

export type RoundParticipantRecord = z.infer<typeof roundParticipantRecordSchema>

/**
 * SPEC "Files": a conversation's chronological record — one round's author
 * message verbatim, which participants were addressed, and each
 * participant's settled outcome in the order it was called.
 */
export const roundRecordSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1).optional(),
  addressed: z.array(z.string().min(1)).readonly(),
  participants: z.array(roundParticipantRecordSchema).readonly(),
  outcome: z.enum(['settled', 'abandoned']),
})

export type RoundRecord = z.infer<typeof roundRecordSchema>

export const conversationSchema = z.object({
  id: z.string().min(1),
  rounds: z.array(roundRecordSchema).readonly(),
})

export type Conversation = z.infer<typeof conversationSchema>
