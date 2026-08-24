import { z } from 'zod'
import { appliedChangeSchema } from './appliedChange.js'
import { failureReasonSchema } from './modelResult.js'

/**
 * What one participant returned for one round, over the wire and on disk.
 * CONTEXT "Response"/"Round": a no-comment outcome carries neither claim nor
 * note; failure, silence and abandonment are ordinary and distinct from one
 * another, never collapsed into a missing value.
 *
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

/**
 * A response that says something: the two outcomes that carry a claim. Both
 * the history a later call is compiled from and the evidence the Story Editor
 * weighs are made of these, and both need the claim's presence to be a fact
 * about the type rather than a re-check — hence a narrowing function rather
 * than a filter each caller writes and then has to assert its way out of.
 */
export type SubstantiveResponse = Extract<ParticipantResult, { kind: 'response'; outcome: 'commentary' | 'applicableSuggestion' }>

export function substantiveResponse(result: ParticipantResult): SubstantiveResponse | undefined {
  return result.kind === 'response' && result.outcome !== 'noComment' ? result : undefined
}

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
/** Which response a round opened to ask about — CONTEXT "Round"/"Addressing": present only on a round asking for a concrete change. */
export const respondingToSchema = z.object({ roundId: z.string().min(1), participantId: z.string().min(1) })

export type RespondingTo = z.infer<typeof respondingToSchema>

export const roundRecordSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1).optional(),
  addressed: z.array(z.string().min(1)).readonly(),
  /** Ids addressing durably enabled by this round, so history keeps saying the room changed. */
  brought: z.array(z.string().min(1)).readonly(),
  /** SPEC "The round": the response this round asked a concrete change about, where it did — never present alongside `message`. */
  respondingTo: respondingToSchema.optional(),
  /** SPEC "The round": the author's own clarification on what they asked, where they gave one. */
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

/**
 * What one round's participant looks like over the wire rather than on disk:
 * CONTEXT "Applied change" presents each applied change on the response that
 * caused it, and the join between a change and the round and participant it
 * names lives above the store rather than in the file `roundParticipantRecordSchema`
 * describes — so this is the record plus that join, never written back.
 */
export const roundParticipantViewSchema = roundParticipantRecordSchema.extend({
  appliedChanges: z.array(appliedChangeSchema).readonly(),
})

export type RoundParticipantView = z.infer<typeof roundParticipantViewSchema>

export const roundViewSchema = roundRecordSchema.extend({
  participants: z.array(roundParticipantViewSchema).readonly(),
})

export type RoundView = z.infer<typeof roundViewSchema>

/** SPEC "Transport": what `GET .../conversations/:cid` reports — a conversation with each applied change resolved onto the response that caused it. */
export const conversationViewSchema = z.object({
  id: z.string().min(1),
  rounds: z.array(roundViewSchema).readonly(),
})

export type ConversationView = z.infer<typeof conversationViewSchema>

/**
 * UX_DESIGN "Conversations": what the listing shows of one conversation and
 * nothing else — no round counts, no participant rosters, no sizes.
 * `opening` is the author's own first message, read down through the
 * conversation's rounds to find one where the first round carried none
 * (CONTEXT "Round": asking a participant for a concrete change opens a round
 * with no message). It is absent only where the conversation holds no
 * author message anywhere in it, which the listing shows as a fact about the
 * machine rather than standing the room's own words in for the author's.
 */
export const conversationSummarySchema = z
  .object({
    id: z.string().min(1),
    opening: z.string().min(1).optional(),
    lastActivity: z.number(),
  })
  .readonly()

export type ConversationSummary = z.infer<typeof conversationSummarySchema>
