import { describe, expect, it } from 'vitest'
import { loadCharter } from '../../../src/server/model/charter.js'
import { compileSpecialistContext, renderPrompt } from '../../../src/server/room/context.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }

describe('loadCharter', () => {
  it('parses and validates the charter shipped with the application, and every field of it reaches its own section of a rendered prompt', () => {
    const charter = loadCharter()
    const context = compileSpecialistContext({
      role: shape,
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
    expect(prompt).toContain(charter.directQuestionOwedAnswer)
    expect(prompt).toContain(charter.noReasoningAboutTheAuthorsQuestion)
  })
})
