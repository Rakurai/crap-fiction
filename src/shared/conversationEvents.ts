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

export const participantActivityEventSchema = z.object({
  actionId: z.string().min(1),
  participantId: z.string().min(1),
  state: z.enum(['preparing', 'working']),
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
  /** Present once the model has answered: the provisional identity a reconnecting client resumes by. */
  applicationId: z.string().min(1).optional(),
})

export type ApplyActivitySnapshot = z.infer<typeof applyActivitySnapshotSchema>

export const conversationActivitySnapshotSchema = z.discriminatedUnion('kind', [
  dispatchActivitySnapshotSchema,
  applyActivitySnapshotSchema,
])

export type ConversationActivitySnapshot = z.infer<typeof conversationActivitySnapshotSchema>

/**
 * What connecting to a piece's event stream delivers before any live frame: the action in
 * flight, if there is one, at each of the piece's three room scopes. Delivered atomically with
 * the subscription itself, so no action can start or finish in the gap between them.
 */
export const roomActivitySnapshotSchema = z
  .object({
    draft: conversationActivitySnapshotSchema.nullable(),
    storyContext: conversationActivitySnapshotSchema.nullable(),
    authorContext: conversationActivitySnapshotSchema.nullable(),
  })
  .readonly()

export type RoomActivitySnapshot = z.infer<typeof roomActivitySnapshotSchema>
