import { z } from 'zod'
import { participantResultSchema, roundParticipantRecordSchema } from './conversationViews.js'

/**
 * SPEC "Model access": a call may report that it is preparing before it is
 * working. `waiting` is the room's own state for a participant the round
 * will call but has not reached yet, seeded from `round.opened` rather than
 * emitted as its own event — SPEC "Seams" has the projection seeding
 * participants in a stable order when the round opens.
 */
export const participantRoundStateSchema = z.enum(['waiting', 'preparing', 'working'])

export type ParticipantRoundState = z.infer<typeof participantRoundStateSchema>

/**
 * SPEC "Transport": the frame around a round — every participant it will call,
 * in the order it will call them, before any of them has been reached. Like
 * every payload below it, it carries the round it belongs to, so a client can
 * discard an event delivered for a round it is no longer watching.
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

/**
 * A round leaves flight exactly once, and `failed` is why the set is three
 * rather than two: a round can end without settling and without the author
 * having abandoned it, and a client that knew only the other two outcomes
 * would have to leave such a round drawn as still running forever.
 */
export const roundClosedEventSchema = z.object({
  roundId: z.string().min(1),
  outcome: z.enum(['settled', 'abandoned', 'failed']),
})

export type RoundClosedEvent = z.infer<typeof roundClosedEventSchema>

/**
 * The room's own failures, named in the product's vocabulary rather than in
 * the vocabulary of whatever threw. The set is closed because a client draws a
 * different notice for each, and an open string would let a message the author
 * cannot act on arrive where a code belongs.
 */
export const roomFailureCodeSchema = z.enum(['CONVERSATION_UNREADABLE', 'CONVERSATION_NOT_WRITTEN'])

export type RoomFailureCode = z.infer<typeof roomFailureCodeSchema>

export const roomErrorEventSchema = z.object({ code: roomFailureCodeSchema, message: z.string() })

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
