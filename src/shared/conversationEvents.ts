import { z } from 'zod'
import { conversationEntryViewSchema } from './conversationEntryViews.js'

// SPEC "Transport": entry- and action-oriented frames. An action is a conversation dispatch or an
// Apply; neither is a durable concept, so nothing here is read back from disk — only entries are.

export const actionKindSchema = z.enum(['dispatch', 'apply'])

export type ActionKind = z.infer<typeof actionKindSchema>

export const actionStartedEventSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  kind: actionKindSchema,
  sourceEntryId: z.string().min(1),
  startedAt: z.number().int().positive(),
  audience: z.array(z.string().min(1)).readonly().optional(),
})

export type ActionStartedEvent = z.infer<typeof actionStartedEventSchema>

export const participantActivityEventSchema = z.object({
  actionId: z.string().min(1),
  participantId: z.string().min(1),
  state: z.enum(['preparing', 'working']),
})

export type ParticipantActivityEvent = z.infer<typeof participantActivityEventSchema>

export const entryAppendedEventSchema = z.object({
  actionId: z.string().min(1),
  entry: conversationEntryViewSchema,
})

export type EntryAppendedEvent = z.infer<typeof entryAppendedEventSchema>

export const actionFinishedEventSchema = z.object({
  actionId: z.string().min(1),
  outcome: z.enum(['settled', 'abandoned', 'failed']),
})

export type ActionFinishedEvent = z.infer<typeof actionFinishedEventSchema>

export const conversationFailureCodeSchema = z.enum(['CONVERSATION_NOT_WRITTEN', 'CONTEXT_UNREADABLE', 'UNEXPECTED_FAILURE'])

export type ConversationFailureCode = z.infer<typeof conversationFailureCodeSchema>

export const conversationErrorEventSchema = z.object({ code: conversationFailureCodeSchema, message: z.string() })

export type ConversationErrorEvent = z.infer<typeof conversationErrorEventSchema>

// What `GET /pieces/:id` reports about a conversation action already in flight, so a client that
// (re)loads mid-action knows what it is watching without waiting for a new event. Landed entries are
// not part of this: they are already durable, and the client reads them from the conversation itself.
export const dispatchActivitySnapshotSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  kind: z.literal('dispatch'),
  sourceEntryId: z.string().min(1),
  audience: z.array(z.string().min(1)).readonly(),
  states: z.record(z.string(), z.enum(['preparing', 'working'])),
  startedAt: z.number().int().positive(),
})

export type DispatchActivitySnapshot = z.infer<typeof dispatchActivitySnapshotSchema>

export const applyActivitySnapshotSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  kind: z.literal('apply'),
  sourceEntryId: z.string().min(1),
  startedAt: z.number().int().positive(),
})

export type ApplyActivitySnapshot = z.infer<typeof applyActivitySnapshotSchema>

export const conversationActivitySnapshotSchema = z.discriminatedUnion('kind', [
  dispatchActivitySnapshotSchema,
  applyActivitySnapshotSchema,
])

export type ConversationActivitySnapshot = z.infer<typeof conversationActivitySnapshotSchema>
