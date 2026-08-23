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
  /**
   * When the round opened, as the studio's own clock read it. UX_DESIGN "A round
   * in flight" requires how long it has been, and PRD "Operational state" makes
   * elapsed time required rather than optional — so the one fact a client cannot
   * derive travels with the round, and everything else about the wait (which
   * participant is working, how many have settled, how long) is derived from this
   * and from the events that follow. A client's own clock would be the wrong one:
   * it starts when the surface mounted, not when the round did, so a reload
   * mid-round would restart the count.
   */
  openedAt: z.number().int().positive(),
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
 * the vocabulary of whatever threw. The set is closed so that a code is a fact
 * the studio decided to state: an open string would let whatever a library threw
 * arrive where a code belongs, and a client is free to draw a different notice
 * for each of these where the interface asks it to.
 */
export const roomFailureCodeSchema = z.enum([
  'CONVERSATION_UNREADABLE',
  'CONVERSATION_NOT_WRITTEN',
  'CONTEXT_UNREADABLE',
  // The three above name what is wrong; this one admits that nothing does. Every
  // outcome a participant call can have is already a record the round returns,
  // so a round that ended some other way ended for a reason the room has no
  // vocabulary for — and the author still has to be told, because the
  // alternative is a round drawn as running that will never close.
  'UNEXPECTED_FAILURE',
])

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
  /** The same stamp `round.opened` carried, so a reload's count continues rather than restarting. */
  openedAt: z.number().int().positive(),
})

export type RoundSnapshot = z.infer<typeof roundSnapshotSchema>
