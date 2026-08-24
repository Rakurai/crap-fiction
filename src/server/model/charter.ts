import { z } from 'zod'
import { readShippedCharter } from '../store/index.js'

const charterSchema = z.object({
  outcomes: z.object({
    noComment: z.string().min(1),
    commentary: z.string().min(1),
    applicableSuggestion: z.string().min(1),
  }),
  recommendationIsOneChange: z.string().min(1),
  directQuestionOwedAnswer: z.string().min(1),
  noReasoningAboutTheAuthorsQuestion: z.string().min(1),
})

export type Charter = Readonly<z.infer<typeof charterSchema>>

export function loadCharter(): Charter {
  return readShippedCharter(charterSchema)
}
