import { z } from 'zod'
import { participantResultSchema, respondingToSchema, roundParticipantRecordSchema } from './conversationViews.js'

export const participantRoundStateSchema = z.enum(['waiting', 'preparing', 'working'])

export type ParticipantRoundState = z.infer<typeof participantRoundStateSchema>

export const roundOpenedEventSchema = z.object({
  conversationId: z.string().min(1),
  roundId: z.string().min(1),
  message: z.string().min(1).optional(),
  participants: z.array(z.string().min(1)).readonly(),
  brought: z.array(z.string().min(1)).readonly(),
  openedAt: z.number().int().positive(),
  respondingTo: respondingToSchema.optional(),
  clarification: z.string().min(1).optional(),
})

export type RoundOpenedEvent = z.infer<typeof roundOpenedEventSchema>

export const participantStateEventSchema = z.object({
  roundId: z.string().min(1),
  participantId: z.string().min(1),
  state: z.enum(['preparing', 'working']),
})

export type ParticipantStateEvent = z.infer<typeof participantStateEventSchema>

export const participantSettledEventSchema = z.object({
  roundId: z.string().min(1),
  participantId: z.string().min(1),
  result: participantResultSchema,
})

export type ParticipantSettledEvent = z.infer<typeof participantSettledEventSchema>

export const roundClosedEventSchema = z.object({
  roundId: z.string().min(1),
  outcome: z.enum(['settled', 'abandoned', 'failed']),
})

export type RoundClosedEvent = z.infer<typeof roundClosedEventSchema>

export const roomFailureCodeSchema = z.enum([
  'CONVERSATION_UNREADABLE',
  'CONVERSATION_NOT_WRITTEN',
  'CONTEXT_UNREADABLE',
  'UNEXPECTED_FAILURE',
])

export type RoomFailureCode = z.infer<typeof roomFailureCodeSchema>

export const roomErrorEventSchema = z.object({ code: roomFailureCodeSchema, message: z.string() })

export type RoomErrorEvent = z.infer<typeof roomErrorEventSchema>

export const roundSnapshotSchema = z.object({
  conversationId: z.string().min(1),
  roundId: z.string().min(1),
  message: z.string().min(1).optional(),
  participants: z.array(z.string().min(1)).readonly(),
  brought: z.array(z.string().min(1)).readonly(),
  states: z.record(z.string(), z.enum(['preparing', 'working'])),
  settled: z.array(roundParticipantRecordSchema).readonly(),
  openedAt: z.number().int().positive(),
  respondingTo: respondingToSchema.optional(),
  clarification: z.string().min(1).optional(),
})

export type RoundSnapshot = z.infer<typeof roundSnapshotSchema>
