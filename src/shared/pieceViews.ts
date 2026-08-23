import { z } from 'zod'
import { durableContextSchema } from './durableContext.js'
import { roundSnapshotSchema } from './roundEvents.js'

/**
 * What a piece looks like over the wire. Both ends need these: the server
 * composes them, the client validates against them. They live here rather
 * than beside the store because a module that touches disk cannot be
 * imported into a browser — `node:fs` externalizes and the client fails at
 * the first import.
 */
export const pieceStatusSchema = z.enum(['drafting', 'finished', 'abandoned'])

export type PieceStatus = z.infer<typeof pieceStatusSchema>

const pieceSummaryShape = z.object({
  id: z.string(),
  title: z.string(),
  mode: z.string(),
  status: pieceStatusSchema,
  length: z.number(),
  modified: z.number(),
})

export const pieceSummarySchema = pieceSummaryShape.readonly()
export type PieceSummary = z.infer<typeof pieceSummarySchema>

/**
 * CONTEXT "Room"/"Participant": one of the piece's specialists, as the surface
 * that lists them needs it — its static role description and whether it is
 * presently in the enabled cast. The Story Editor is never one of these
 * (CONTEXT "Room": "the Story Editor is always present and is not one of them").
 */
export const castMemberViewSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    roleDescription: z.string(),
    enabled: z.boolean(),
  })
  .readonly()
export type CastMemberView = z.infer<typeof castMemberViewSchema>

/**
 * SPEC "Transport": opening a piece reports its metadata, its draft, its story
 * context, and whatever round is in flight, so a client that reloaded knows what
 * it is looking at without a new event. `currentConversationId` is `null` until a
 * conversation's first round has opened (CONTEXT "Conversation"), and a piece
 * whose story context has not been written yet reports no sections — the author
 * has only named the piece (SPEC "Files"). `cast` is every specialist the mode's
 * cast admits for this piece, not only the enabled ones, since the room-editing
 * surface (#13) lists a specialist to enable it as readily as to disable one.
 */
export const pieceDetailSchema = pieceSummaryShape
  .extend({
    draft: z.string(),
    storyContext: durableContextSchema,
    currentConversationId: z.string().nullable(),
    roundInFlight: roundSnapshotSchema.nullable(),
    cast: z.array(castMemberViewSchema).readonly(),
  })
  .readonly()
export type PieceDetail = z.infer<typeof pieceDetailSchema>
