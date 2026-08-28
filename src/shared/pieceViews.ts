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

export const rosterMemberViewSchema = z
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
export type RosterMemberView = z.infer<typeof rosterMemberViewSchema>

export const storyEditorViewSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    description: z.string(),
    mark: z.string(),
  })
  .readonly()
export type StoryEditorView = z.infer<typeof storyEditorViewSchema>

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
    location: z.string().min(1),
    referenceSchema: z.string().nullable(),
    currentConversationId: z.string().nullable(),
    conversations: z.array(conversationSummarySchema).readonly(),
    roster: z.array(rosterMemberViewSchema).readonly(),
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
