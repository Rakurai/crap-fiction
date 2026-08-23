import { z } from 'zod'
import { participantResultSchema, roundParticipantRecordSchema } from './conversationViews.js'

/**
 * SPEC "Model access": a call may report that it is preparing before it is
 * working. `waiting` is the room's own state for a participant the round
 * will call but has not reached yet, seeded from `round.opened` rather than
 * emitted as its own event (SPEC "The client's projection... participants
 * are seeded in a stable order when the round opens").
 */
export const participantRoundStateSchema = z.enum(['waiting', 'preparing', 'working'])

export type ParticipantRoundState = z.infer<typeof participantRoundStateSchema>

/**
 * SPEC "Transport": the closed SSE event set, one payload shape per event.
 * Every payload carries the round it belongs to, so a client can discard an
 * event delivered for a round that is no longer the one it is watching.
 */
export const roundOpenedEventSchema = z.object({
  conversationId: z.string().min(1),
  roundId: z.string().min(1),
  message: z.string().min(1).optional(),
  participants: z.array(z.string().min(1)).readonly(),
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
  outcome: z.enum(['settled', 'abandoned']),
})

export type RoundClosedEvent = z.infer<typeof roundClosedEventSchema>

export const roomErrorEventSchema = z.object({ code: z.string(), message: z.string() })

export type RoomErrorEvent = z.infer<typeof roomErrorEventSchema>

/**
 * What `GET /pieces/:id` reports about a round in flight, so a client that
 * reloaded mid-round knows what it is looking at without a new event (SPEC
 * "Operation state").
 */
export const roundSnapshotSchema = z.object({
  conversationId: z.string().min(1),
  roundId: z.string().min(1),
  message: z.string().min(1).optional(),
  participants: z.array(z.string().min(1)).readonly(),
  states: z.record(z.string(), z.enum(['preparing', 'working'])),
  settled: z.array(roundParticipantRecordSchema).readonly(),
})

export type RoundSnapshot = z.infer<typeof roundSnapshotSchema>
