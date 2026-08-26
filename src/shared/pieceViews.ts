import { z } from 'zod'
import { conversationSummarySchema } from './conversationEntries.js'

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
    handle: z.string(),
    displayName: z.string(),
    description: z.string(),
    enabled: z.boolean(),
  })
  .readonly()
export type CastMemberView = z.infer<typeof castMemberViewSchema>

export const storyEditorViewSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    description: z.string(),
  })
  .readonly()
export type StoryEditorView = z.infer<typeof storyEditorViewSchema>

export const surfaceDetailSchema = z
  .object({
    text: z.string(),
    referenceSchema: z.string().nullable(),
    currentConversationId: z.string().nullable(),
    conversations: z.array(conversationSummarySchema).readonly(),
    cast: z.array(castMemberViewSchema).readonly(),
  })
  .readonly()
export type SurfaceDetail = z.infer<typeof surfaceDetailSchema>

export const pieceSurfacesSchema = z
  .object({
    draft: surfaceDetailSchema,
    storyContext: surfaceDetailSchema,
    authorContext: surfaceDetailSchema,
  })
  .readonly()
export type PieceSurfaces = z.infer<typeof pieceSurfacesSchema>

export const pieceDetailSchema = pieceSummaryShape
  .extend({
    surfaces: pieceSurfacesSchema,
    storyEditor: storyEditorViewSchema,
  })
  .readonly()
export type PieceDetail = z.infer<typeof pieceDetailSchema>
