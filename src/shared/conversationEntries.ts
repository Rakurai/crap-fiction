import { z } from 'zod'
import { failureReasonSchema } from './modelResult.js'

// The substrate for the conversation cutover (#58): a durable conversation is an ordered,
// append-only sequence of these entries rather than a nested round record. Nothing here is wired
// into the active room or conversation path yet — see SPEC_GAPS.md.

export const authorMessageEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('authorMessage'),
  text: z.string().min(1),
  audience: z.array(z.string().min(1)).readonly(),
  brought: z.array(z.string().min(1)).readonly(),
})

export type AuthorMessageEntry = z.infer<typeof authorMessageEntrySchema>

export const concreteChangeRequestEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('concreteChangeRequest'),
  target: z.string().min(1),
  respondingTo: z.string().min(1),
  clarification: z.string().min(1).optional(),
})

export type ConcreteChangeRequestEntry = z.infer<typeof concreteChangeRequestEntrySchema>

export const participantResponseEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('participantResponse'),
  participantId: z.string().min(1),
  causeId: z.string().min(1),
  outcome: z.enum(['commentary', 'applicableSuggestion']),
  claim: z.string().min(1),
  note: z.string().optional(),
})

export type ParticipantResponseEntry = z.infer<typeof participantResponseEntrySchema>

export const participantNoCommentEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('participantNoComment'),
  participantId: z.string().min(1),
  causeId: z.string().min(1),
})

export type ParticipantNoCommentEntry = z.infer<typeof participantNoCommentEntrySchema>

export const participantFailureEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('participantFailure'),
  participantId: z.string().min(1),
  causeId: z.string().min(1),
  reason: failureReasonSchema,
  returned: z.string().optional(),
})

export type ParticipantFailureEntry = z.infer<typeof participantFailureEntrySchema>

export const applicationEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('application'),
  responseId: z.string().min(1),
  changeId: z.string().min(1),
})

export type ApplicationEntry = z.infer<typeof applicationEntrySchema>

export const conversationEntrySchema = z.discriminatedUnion('kind', [
  authorMessageEntrySchema,
  concreteChangeRequestEntrySchema,
  participantResponseEntrySchema,
  participantNoCommentEntrySchema,
  participantFailureEntrySchema,
  applicationEntrySchema,
])

export type ConversationEntry = z.infer<typeof conversationEntrySchema>

export const entryConversationSchema = z.object({
  id: z.string().min(1),
  entries: z.array(conversationEntrySchema).readonly(),
})

export type EntryConversation = z.infer<typeof entryConversationSchema>
