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

const addressableIdentity = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  description: z.string(),
  mark: z.string(),
})

const addressableParticipantViewSchema = z.discriminatedUnion('eligibility', [
  addressableIdentity.extend({ eligibility: z.literal('cast'), ordinal: z.number(), enabled: z.boolean() }).readonly(),
  addressableIdentity.extend({ eligibility: z.literal('generalist') }).readonly(),
  addressableIdentity.extend({ eligibility: z.literal('addressed-only'), ordinal: z.number() }).readonly(),
])
export type AddressableParticipantView = z.infer<typeof addressableParticipantViewSchema>

const storyEditorViewSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    description: z.string(),
    mark: z.string(),
  })
  .readonly()
export type StoryEditorView = z.infer<typeof storyEditorViewSchema>

const interviewerViewSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    description: z.string(),
    invocation: z.string(),
  })
  .readonly()
export type InterviewerView = z.infer<typeof interviewerViewSchema>

const surfaceDetailSchema = z
  .object({
    text: z.string(),
    location: z.string().min(1),
    referenceSchema: z.string().nullable(),
    currentConversationId: z.string().nullable(),
    conversations: z.array(conversationSummarySchema).readonly(),
    addressable: z.array(addressableParticipantViewSchema).readonly(),
  })
  .readonly()
export type SurfaceDetail = z.infer<typeof surfaceDetailSchema>

const pieceSurfacesSchema = z
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
