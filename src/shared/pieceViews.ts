import { z } from 'zod'
import { conversationSummarySchema } from './conversationEntries.js'

const pieceSummaryShape = z.object({
  id: z.string(),
  title: z.string(),
  mode: z.string(),
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
    mark: z.string(),
    ordinal: z.number(),
    enabled: z.boolean(),
  })
  .readonly()
export type CastMemberView = z.infer<typeof castMemberViewSchema>

export const storyEditorViewSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    description: z.string(),
    mark: z.string(),
  })
  .readonly()
export type StoryEditorView = z.infer<typeof storyEditorViewSchema>

/** The declared Interviewer as the client needs it: whom to name, and the words its affordance sends. */
export const interviewerViewSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    description: z.string(),
    invocation: z.string(),
  })
  .readonly()
export type InterviewerView = z.infer<typeof interviewerViewSchema>

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
    interviewer: interviewerViewSchema,
  })
  .readonly()
export type PieceDetail = z.infer<typeof pieceDetailSchema>
