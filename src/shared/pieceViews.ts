import { z } from 'zod'
import { captureSnapshotSchema } from './captureViews.js'
import { conversationSummarySchema } from './conversationEntries.js'
import { conversationActivitySnapshotSchema } from './conversationEvents.js'
import { durableContextSchema } from './durableContext.js'

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

export const castMemberViewSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    roleDescription: z.string(),
    enabled: z.boolean(),
  })
  .readonly()
export type CastMemberView = z.infer<typeof castMemberViewSchema>

export const pieceDetailSchema = pieceSummaryShape
  .extend({
    draft: z.string(),
    storyContext: durableContextSchema,
    currentConversationId: z.string().nullable(),
    conversations: z.array(conversationSummarySchema).readonly(),
    conversationActionInFlight: conversationActivitySnapshotSchema.nullable(),
    captureInFlight: captureSnapshotSchema.nullable(),
    cast: z.array(castMemberViewSchema).readonly(),
  })
  .readonly()
export type PieceDetail = z.infer<typeof pieceDetailSchema>
