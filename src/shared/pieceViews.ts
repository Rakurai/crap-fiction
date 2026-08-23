import { z } from 'zod'

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

export const pieceDetailSchema = pieceSummaryShape.extend({ draft: z.string() }).readonly()
export type PieceDetail = z.infer<typeof pieceDetailSchema>
