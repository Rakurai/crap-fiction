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

// SPEC "Files": an application names only the identifier of the change it produced, and the change's
// own content sits in its own file. The view joins them so the client never opens that file itself.
export const applicationEntryViewSchema = applicationEntrySchema.extend({
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
