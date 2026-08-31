import { z } from 'zod'
import { failureReasonSchema } from './modelResult.js'
import { substantiveOutcomeSchema } from './participantResponse.js'

export const authorMessageEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('authorMessage'),
  text: z.string().min(1),
  audience: z.array(z.string().min(1)).readonly(),
  brought: z.array(z.string().min(1)).readonly(),
  atMs: z.number().optional(),
  castSize: z.number().int().nonnegative().optional(),
})

export type AuthorMessageEntry = z.infer<typeof authorMessageEntrySchema>

export const concreteChangeRequestEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('concreteChangeRequest'),
  target: z.string().min(1),
  respondingTo: z.string().min(1),
  clarification: z.string().min(1).optional(),
  atMs: z.number().optional(),
})

export type ConcreteChangeRequestEntry = z.infer<typeof concreteChangeRequestEntrySchema>

export const participantResponseEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.literal('participantResponse'),
  participantId: z.string().min(1),
  causeId: z.string().min(1),
  outcome: substantiveOutcomeSchema,
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
  constraint: z.string().min(1).optional(),
})

export type ApplicationEntry = z.infer<typeof applicationEntrySchema>

const conversationEntrySchema = z.discriminatedUnion('kind', [
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

export function openingWords(entries: readonly ConversationEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.kind === 'authorMessage') return entry.text
    if (entry.kind === 'concreteChangeRequest' && entry.clarification !== undefined) return entry.clarification
  }
  return undefined
}

export const conversationSummarySchema = z
  .object({
    id: z.string().min(1),
    opening: z.string().min(1).optional(),
    lastActivity: z.number(),
  })
  .readonly()

export type ConversationSummary = z.infer<typeof conversationSummarySchema>
