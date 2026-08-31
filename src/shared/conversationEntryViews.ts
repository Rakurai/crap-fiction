import { z } from 'zod'
import { appliedChangeContentSchema } from './appliedChange.js'
import {
  applicationEntrySchema,
  authorMessageEntrySchema,
  concreteChangeRequestEntrySchema,
  participantFailureEntrySchema,
  participantNoCommentEntrySchema,
  participantResponseEntrySchema,
} from './conversationEntries.js'

const applicationEntryViewSchema = applicationEntrySchema.extend({
  change: appliedChangeContentSchema.optional(),
})

export type ApplicationEntryView = z.infer<typeof applicationEntryViewSchema>

export const conversationEntryViewSchema = z.discriminatedUnion('kind', [
  authorMessageEntrySchema,
  concreteChangeRequestEntrySchema,
  participantResponseEntrySchema,
  participantNoCommentEntrySchema,
  participantFailureEntrySchema,
  applicationEntryViewSchema,
])

export type ConversationEntryView = z.infer<typeof conversationEntryViewSchema>

export const entryConversationViewSchema = z.object({
  id: z.string().min(1),
  entries: z.array(conversationEntryViewSchema).readonly(),
})

export type EntryConversationView = z.infer<typeof entryConversationViewSchema>
