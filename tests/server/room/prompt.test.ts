import { describe, expect, it } from 'vitest'
import { loadCharter } from '../../../src/server/model/charter.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import { compileSpecialistContext, renderPrompt } from '../../../src/server/room/context.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }

/**
 * The charter shipped with the application, rendered. `loadCharter` is here rather
 * than a literal because a charter clause nobody renders is a guarantee the room
 * does not make, and the shipped file is the only one that ships — but what is
 * asserted is `renderPrompt`'s, which is why this sits with the room rather than
 * with the model.
 */
describe('the prompt a specialist is called with', () => {
  it('carries every clause of the shipped charter, each in its own section', () => {
    const charter = loadCharter()
    const context = compileSpecialistContext({
      role: shape,
      criteria: undefined,
      owesAnswer: true,
      message: undefined,
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: undefined,
      policy: 'shared',
    })

    const prompt = renderPrompt(context, charter)

    expect(prompt).toContain(charter.outcomes.noComment)
    expect(prompt).toContain(charter.outcomes.commentary)
    expect(prompt).toContain(charter.outcomes.applicableSuggestion)
    expect(prompt).toContain(charter.recommendationIsOneChange)
    expect(prompt).toContain(charter.directQuestionOwedAnswer)
    expect(prompt).toContain(charter.noReasoningAboutTheAuthorsQuestion)
  })
})
