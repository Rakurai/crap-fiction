import { describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import { compileSpecialistContext, renderPrompt } from '../../../src/server/room/context.js'
import { CHARTER_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../../support/roomFixtures.js'

const shape: RoleDefinition = {
  id: 'shape',
  handle: 'shape',
  displayName: 'Shape',
  description: 'reasons about the turn',
  persona: 'reasons about reasons about the turn',
  eligibility: 'cast',
  availability: [],
}

describe('the prompt a specialist is called with', () => {
  it('carries the whole charter, composed as one section, and the addressed obligation only when it was owed one', () => {
    const context = compileSpecialistContext({
      role: shape,
      modeDescription: 'A short piece read in one sitting.',
      owesAnswer: true,
      message: undefined,
      ask: undefined,
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      entries: undefined,
      policy: 'shared',
      participants: new Map(),
    })

    const prompt = renderPrompt(context, PROMPT_FRAGMENTS_FIXTURE, CHARTER_FIXTURE)

    expect(prompt).toContain(CHARTER_FIXTURE)
    expect(prompt).toContain('FIXTURE_ADDRESSED_HEADING')
  })
})
