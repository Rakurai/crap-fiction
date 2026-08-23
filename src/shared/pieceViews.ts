import { z } from 'zod'
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
 * SPEC "Transport": opening a piece reports whatever round is in flight and
 * which conversation is current, so a client that reloaded knows what it is
 * looking at without a new event. `currentConversationId` is `null` until a
 * conversation's first round has opened (CONTEXT "Conversation").
 */
export const pieceDetailSchema = pieceSummaryShape
  .extend({
    draft: z.string(),
    currentConversationId: z.string().nullable(),
    roundInFlight: roundSnapshotSchema.nullable(),
  })
  .readonly()
export type PieceDetail = z.infer<typeof pieceDetailSchema>
