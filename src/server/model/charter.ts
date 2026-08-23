import { z } from 'zod'
import { readYamlFile } from '../store.js'

const charterSchema = z.object({
  outcomes: z.object({
    noComment: z.string().min(1),
    commentary: z.string().min(1),
    applicableSuggestion: z.string().min(1),
  }),
  directQuestionOwedAnswer: z.string().min(1),
  noReasoningAboutTheAuthorsQuestion: z.string().min(1),
})

export type Charter = Readonly<z.infer<typeof charterSchema>>

/**
 * SPEC "Files": the participant charter is what every participant is told
 * regardless of which one it is — the three outcomes and what makes a
 * recommendation applicable rather than commentary, that a direct question
 * is owed an answer, and that nothing reasons about the author's question
 * instead of about the story. It ships as its own file, separate from the
 * role definitions and the mode descriptors, read through the store's
 * shared shipped-data loader: an absent or invalid charter is a startup
 * failure naming the file and the entry, on the same terms as the other two
 * kinds of shipped data.
 */
export function loadCharter(filePath: string): Charter {
  return readYamlFile(filePath, charterSchema)
}
