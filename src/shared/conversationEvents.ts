import { z } from 'zod'
import { conversationEntryViewSchema } from './conversationEntryViews.js'
import { surfaceIdSchema } from './surfaces.js'

export const actionKindSchema = z.enum(['dispatch', 'apply'])

export type ActionKind = z.infer<typeof actionKindSchema>

const startedFields = {
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  sourceEntryId: z.string().min(1),
  startedAt: z.number().int().positive(),
  surface: surfaceIdSchema,
}

export const dispatchStartedEventSchema = z.object({ ...startedFields, kind: z.literal('dispatch'), audience: z.array(z.string().min(1)).readonly() })

export const applyStartedEventSchema = z.object({ ...startedFields, kind: z.literal('apply') })

export const actionStartedEventSchema = z.discriminatedUnion('kind', [dispatchStartedEventSchema, applyStartedEventSchema])

export type ActionStartedEvent = z.infer<typeof actionStartedEventSchema>

export const applyPendingEventSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  applicationId: z.string().min(1),
  sourceEntryId: z.string().min(1),
  surface: surfaceIdSchema,
})

export type ApplyPendingEvent = z.infer<typeof applyPendingEventSchema>

export const participantActivityEventSchema = z.object({
  actionId: z.string().min(1),
  participantId: z.string().min(1),
  state: z.enum(['waiting', 'preparing', 'working']),
  startedAt: z.number().int().positive(),
  surface: surfaceIdSchema,
})

export type ParticipantActivityEvent = z.infer<typeof participantActivityEventSchema>

export const entryAppendedEventSchema = z.object({
  actionId: z.string().min(1),
  entry: conversationEntryViewSchema,
  surface: surfaceIdSchema,
})

export type EntryAppendedEvent = z.infer<typeof entryAppendedEventSchema>

export const actionFinishedEventSchema = z.object({
  actionId: z.string().min(1),
  outcome: z.enum(['settled', 'abandoned', 'failed']),
  surface: surfaceIdSchema,
})

export type ActionFinishedEvent = z.infer<typeof actionFinishedEventSchema>

export const conversationFailureCodeSchema = z.enum(['CONVERSATION_NOT_WRITTEN', 'UNEXPECTED_FAILURE'])

export type ConversationFailureCode = z.infer<typeof conversationFailureCodeSchema>

export const conversationErrorEventSchema = z.object({ code: conversationFailureCodeSchema, message: z.string(), surface: surfaceIdSchema })

export type ConversationErrorEvent = z.infer<typeof conversationErrorEventSchema>

export const participantStateSchema = z.object({
  state: z.enum(['waiting', 'preparing', 'working']),
  startedAt: z.number().int().positive(),
})

export type ParticipantState = z.infer<typeof participantStateSchema>

export const dispatchActivitySnapshotSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  kind: z.literal('dispatch'),
  sourceEntryId: z.string().min(1),
  audience: z.array(z.string().min(1)).readonly(),
  states: z.record(z.string(), participantStateSchema),
  startedAt: z.number().int().positive(),
})

export type DispatchActivitySnapshot = z.infer<typeof dispatchActivitySnapshotSchema>

export const applyActivitySnapshotSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  kind: z.literal('apply'),
  sourceEntryId: z.string().min(1),
  startedAt: z.number().int().positive(),
  applicationId: z.string().min(1).optional(),
})

export type ApplyActivitySnapshot = z.infer<typeof applyActivitySnapshotSchema>

export const conversationActivitySnapshotSchema = z.discriminatedUnion('kind', [
  dispatchActivitySnapshotSchema,
  applyActivitySnapshotSchema,
])

export type ConversationActivitySnapshot = z.infer<typeof conversationActivitySnapshotSchema>

export const roomActivitySnapshotSchema = z
  .object({
    draft: conversationActivitySnapshotSchema.nullable(),
    storyContext: conversationActivitySnapshotSchema.nullable(),
    authorContext: conversationActivitySnapshotSchema.nullable(),
  })
  .readonly()

export type RoomActivitySnapshot = z.infer<typeof roomActivitySnapshotSchema>
