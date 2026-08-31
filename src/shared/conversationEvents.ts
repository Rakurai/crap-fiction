import { z } from 'zod'
import { conversationEntryViewSchema } from './conversationEntryViews.js'
import { failureCodeSchema } from './envelope.js'
import { surfaceIdSchema } from './surfaces.js'

const actionKindSchema = z.enum(['dispatch', 'apply'])

export type ActionKind = z.infer<typeof actionKindSchema>

const startedFields = {
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  sourceEntryId: z.string().min(1),
  startedAt: z.number().int().positive(),
  surface: surfaceIdSchema,
}

const dispatchStartedEventSchema = z.object({ ...startedFields, kind: z.literal('dispatch'), audience: z.array(z.string().min(1)).readonly() })

const applyStartedEventSchema = z.object({ ...startedFields, kind: z.literal('apply') })

const actionStartedEventSchema = z.discriminatedUnion('kind', [dispatchStartedEventSchema, applyStartedEventSchema])

export type ActionStartedEvent = z.infer<typeof actionStartedEventSchema>

const applyPendingEventSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  applicationId: z.string().min(1),
  sourceEntryId: z.string().min(1),
  surface: surfaceIdSchema,
})

export type ApplyPendingEvent = z.infer<typeof applyPendingEventSchema>

export const participantStageSchema = z.enum(['called', 'preparing', 'working'])

export type ParticipantStage = z.infer<typeof participantStageSchema>

const participantStateSchema = z.object({
  state: participantStageSchema,
  startedAt: z.number().int().positive(),
})

export type ParticipantState = z.infer<typeof participantStateSchema>

const participantActivityEventSchema = z.object({
  actionId: z.string().min(1),
  participantId: z.string().min(1),
  ...participantStateSchema.shape,
  surface: surfaceIdSchema,
})

export type ParticipantActivityEvent = z.infer<typeof participantActivityEventSchema>

const entryAppendedEventSchema = z.object({
  actionId: z.string().min(1),
  entry: conversationEntryViewSchema,
  surface: surfaceIdSchema,
})

export type EntryAppendedEvent = z.infer<typeof entryAppendedEventSchema>

const actionFinishedEventSchema = z.object({
  actionId: z.string().min(1),
  outcome: z.enum(['settled', 'abandoned', 'failed']),
  surface: surfaceIdSchema,
})

export type ActionFinishedEvent = z.infer<typeof actionFinishedEventSchema>

const conversationFailureCodeSchema = failureCodeSchema.extract(['CONVERSATION_NOT_WRITTEN', 'UNEXPECTED_FAILURE'])

export type ConversationFailureCode = z.infer<typeof conversationFailureCodeSchema>

const conversationErrorEventSchema = z.object({ code: conversationFailureCodeSchema, message: z.string(), surface: surfaceIdSchema })

export type ConversationErrorEvent = z.infer<typeof conversationErrorEventSchema>

const dispatchActivitySnapshotSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  kind: z.literal('dispatch'),
  sourceEntryId: z.string().min(1),
  audience: z.array(z.string().min(1)).readonly(),
  states: z.record(z.string(), participantStateSchema),
  startedAt: z.number().int().positive(),
})

export type DispatchActivitySnapshot = z.infer<typeof dispatchActivitySnapshotSchema>

const applyActivitySnapshotSchema = z.object({
  actionId: z.string().min(1),
  conversationId: z.string().min(1),
  kind: z.literal('apply'),
  sourceEntryId: z.string().min(1),
  startedAt: z.number().int().positive(),
  applicationId: z.string().min(1).optional(),
})

export type ApplyActivitySnapshot = z.infer<typeof applyActivitySnapshotSchema>

const conversationActivitySnapshotSchema = z.discriminatedUnion('kind', [
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

const roomEventNameSchema = z.enum([
  'activity.snapshot',
  'action.started',
  'apply.pending',
  'participant.activity',
  'entry.appended',
  'action.finished',
  'error',
])

export type RoomEventName = z.infer<typeof roomEventNameSchema>

export const roomEventSchema = z.discriminatedUnion('type', [
  z.object({ type: roomEventNameSchema.extract(['action.started']), data: actionStartedEventSchema }),
  z.object({ type: roomEventNameSchema.extract(['apply.pending']), data: applyPendingEventSchema }),
  z.object({ type: roomEventNameSchema.extract(['participant.activity']), data: participantActivityEventSchema }),
  z.object({ type: roomEventNameSchema.extract(['entry.appended']), data: entryAppendedEventSchema }),
  z.object({ type: roomEventNameSchema.extract(['action.finished']), data: actionFinishedEventSchema }),
  z.object({ type: roomEventNameSchema.extract(['error']), data: conversationErrorEventSchema }),
])

export type RoomEvent = z.infer<typeof roomEventSchema>
