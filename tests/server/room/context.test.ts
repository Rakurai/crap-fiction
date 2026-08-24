import { describe, expect, it } from 'vitest'
import {
  compileApplyContext,
  compileCaptureContext,
  compileSpecialistContext,
  compileStoryEditorContext,
  renderApplyPrompt,
  renderCapturePrompt,
  renderPrompt,
  type ApplyContextInput,
  type CaptureContextInput,
  type ContextInput,
  type HistoryPolicy,
} from '../../../src/server/room/context.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { Conversation } from '../../../src/shared/conversationViews.js'
import { CHARTER_FIXTURE } from '../../support/charter.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'reasons about omission' }

const charter = CHARTER_FIXTURE

function contextInput(overrides: Partial<ContextInput> & { role: RoleDefinition }): ContextInput {
  return {
    criteria: undefined,
    owesAnswer: false,
    message: undefined,
    ask: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    conversation: undefined,
    policy: 'shared',
    ...overrides,
  }
}

function sectionOf(prompt: string, heading: string): string {
  const [, body] = prompt.split(`## ${heading}\n`)
  if (body === undefined) throw new Error(`no "${heading}" section in the prompt`)
  return body.split('\n## ')[0] ?? body
}

const conversationWithMixedHistory: Conversation = {
  id: 'c1',
  rounds: [
    {
      id: 'r1',
      message: 'first question',
      addressed: [],
      brought: [],
      outcome: 'settled',
      participants: [
        { participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late' } },
        { participantId: 'compression', result: { kind: 'response', outcome: 'noComment' } },
      ],
    },
  ],
}

function applyContextInput(overrides: Partial<ApplyContextInput> & { conversation: ApplyContextInput['conversation']; throughRoundId: string }): ApplyContextInput {
  return {
    recommendationClaim: 'cut the second paragraph',
    recommendationNote: undefined,
    constraint: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    ...overrides,
  }
}

const conversationWithTwoRounds: Conversation = {
  id: 'c1',
  rounds: [
    {
      id: 'r1',
      message: 'first question',
      addressed: [],
      brought: [],
      outcome: 'settled',
      participants: [
        { participantId: 'shape', result: { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut the second paragraph', note: 'it repeats the opening' } },
      ],
    },
    {
      id: 'r2',
      message: 'a later question',
      addressed: [],
      brought: [],
      outcome: 'settled',
      participants: [{ participantId: 'compression', result: { kind: 'response', outcome: 'commentary', claim: 'the ending still drags' } }],
    },
  ],
}

describe('compileApplyContext', () => {
  it('carries the recommendation, the constraint and both durable contexts through untouched', () => {
    const context = compileApplyContext(
      applyContextInput({
        recommendationClaim: 'cut the second paragraph',
        recommendationNote: 'it repeats the opening',
        constraint: 'keep the last line',
        authorContext: 'prefers short sentences',
        storyContext: 'a flash piece about a breakup',
        draft: 'The cups sat where she left them.',
        conversation: conversationWithTwoRounds,
        throughRoundId: 'r1',
      }),
    )

    expect(context.recommendationClaim).toBe('cut the second paragraph')
    expect(context.recommendationNote).toBe('it repeats the opening')
    expect(context.constraint).toBe('keep the last line')
    expect(context.authorContext).toBe('prefers short sentences')
    expect(context.storyContext).toBe('a flash piece about a breakup')
    expect(context.draft).toBe('The cups sat where she left them.')
  })

  it('reads history through the round the recommendation came from, and no further', () => {
    const context = compileApplyContext(applyContextInput({ conversation: conversationWithTwoRounds, throughRoundId: 'r1' }))

    expect(context.history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'response', participantId: 'shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
    ])
  })

  it('carries no constraint when the author supplied none', () => {
    const context = compileApplyContext(applyContextInput({ conversation: conversationWithTwoRounds, throughRoundId: 'r1' }))

    expect(context.constraint).toBeUndefined()
  })
})

describe('renderApplyPrompt', () => {
  it('states the recommendation and the constraint, each under its own section', () => {
    const context = compileApplyContext(
      applyContextInput({
        recommendationClaim: 'cut the second paragraph',
        constraint: 'keep the last line',
        conversation: conversationWithTwoRounds,
        throughRoundId: 'r1',
      }),
    )

    const prompt = renderApplyPrompt(context, charter)
    expect(prompt).toContain('cut the second paragraph')
    expect(prompt).toContain("The author's constraint")
    expect(prompt).toContain('keep the last line')
  })

  it('omits the constraint section when the author supplied none', () => {
    const context = compileApplyContext(applyContextInput({ conversation: conversationWithTwoRounds, throughRoundId: 'r1' }))

    expect(renderApplyPrompt(context, charter)).not.toContain("The author's constraint")
  })

  it('always carries the manuscript, unexcerpted', () => {
    const context = compileApplyContext(
      applyContextInput({ draft: 'The cups sat where she left them.', conversation: conversationWithTwoRounds, throughRoundId: 'r1' }),
    )

    expect(renderApplyPrompt(context, charter)).toContain('The cups sat where she left them.')
  })
})

function captureContextInput(overrides: Partial<CaptureContextInput> = {}): CaptureContextInput {
  return {
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    conversation: undefined,
    ...overrides,
  }
}

describe('compileCaptureContext', () => {
  it('carries the draft and both durable contexts through untouched', () => {
    const context = compileCaptureContext(
      captureContextInput({
        authorContext: 'prefers short sentences',
        storyContext: 'a flash piece about a breakup',
        draft: 'The cups sat where she left them.',
      }),
    )

    expect(context.authorContext).toBe('prefers short sentences')
    expect(context.storyContext).toBe('a flash piece about a breakup')
    expect(context.draft).toBe('The cups sat where she left them.')
  })

  it('is empty of history where no conversation exists yet', () => {
    const context = compileCaptureContext(captureContextInput())

    expect(context.history).toEqual([])
  })

  it('reads the conversation whole, past any one round — unlike an application, it has none to stop at', () => {
    const context = compileCaptureContext(captureContextInput({ conversation: conversationWithTwoRounds }))

    expect(context.history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'response', participantId: 'shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
      { kind: 'message', text: 'a later question' },
      { kind: 'response', participantId: 'compression', claim: 'the ending still drags', note: undefined },
    ])
  })
})

describe('renderCapturePrompt', () => {
  it('always carries the manuscript, unexcerpted', () => {
    const context = compileCaptureContext(captureContextInput({ draft: 'The cups sat where she left them.' }))

    expect(renderCapturePrompt(context)).toContain('The cups sat where she left them.')
  })

  it('includes a context section, heading and body, once the author has written it', () => {
    const context = compileCaptureContext(
      captureContextInput({ authorContext: 'prefers short sentences', storyContext: 'a flash piece about a breakup' }),
    )

    const prompt = renderCapturePrompt(context)
    expect(prompt).toContain('Author context')
    expect(prompt).toContain('prefers short sentences')
    expect(prompt).toContain('Story context')
    expect(prompt).toContain('a flash piece about a breakup')
  })

  it('omits an unwritten context section entirely, rather than sending an empty heading', () => {
    const prompt = renderCapturePrompt(compileCaptureContext(captureContextInput()))

    expect(prompt).not.toContain('Author context')
    expect(prompt).not.toContain('Story context')
  })

  it('states the threshold asymmetry between the two destinations', () => {
    const prompt = renderCapturePrompt(compileCaptureContext(captureContextInput()))

    expect(prompt).toContain('story context')
    expect(prompt).toContain('author context')
    expect(prompt).toMatch(/rare/)
  })
})

describe('compileSpecialistContext', () => {
  it('carries the draft, the message and both durable contexts through untouched', () => {
    const context = compileSpecialistContext(
      contextInput({
        role: shape,
        owesAnswer: true,
        message: 'does the opening earn its length',
        authorContext: 'prefers short sentences',
        storyContext: 'a flash piece about a breakup',
        draft: 'The cups sat where she left them.',
      }),
    )

    expect(context.role).toBe(shape)
    expect(context.owesAnswer).toBe(true)
    expect(context.message).toBe('does the opening earn its length')
    expect(context.authorContext).toBe('prefers short sentences')
    expect(context.storyContext).toBe('a flash piece about a breakup')
    expect(context.draft).toBe('The cups sat where she left them.')
  })

  it('carries no author or story context when neither has been written', () => {
    const context = compileSpecialistContext(contextInput({ role: shape }))

    expect(context.authorContext).toBeUndefined()
    expect(context.storyContext).toBeUndefined()
  })

  it('is empty of history for the first round of a conversation', () => {
    const context = compileSpecialistContext(contextInput({ role: shape, message: 'a message' }))

    expect(context.history).toEqual([])
  })

  it('shared history includes every prior message and every substantive response, regardless of who gave it', () => {
    const context = compileSpecialistContext(
      contextInput({ role: compression, message: 'a second question', conversation: conversationWithMixedHistory }),
    )

    expect(context.history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'response', participantId: 'shape', claim: 'the entry is late', note: undefined },
    ])
  })

  it('the stricter policy filters another specialist\'s unapplied historical response and keeps the participant\'s own', () => {
    const stricter: HistoryPolicy = 'stricter'
    const forShape = compileSpecialistContext(contextInput({ role: shape, conversation: conversationWithMixedHistory, policy: stricter }))
    const forCompression = compileSpecialistContext(
      contextInput({ role: compression, conversation: conversationWithMixedHistory, policy: stricter }),
    )

    expect(forShape.history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'response', participantId: 'shape', claim: 'the entry is late', note: undefined },
    ])
    expect(forCompression.history).toEqual([{ kind: 'message', text: 'first question' }])
  })

  it('SPEC "Context compilation": carries no reading from the round being formed, under either policy, because a specialist call has nowhere for one to arrive', () => {
    for (const policy of ['shared', 'stricter'] as const) {
      const context = compileSpecialistContext(contextInput({ role: shape, conversation: conversationWithMixedHistory, policy }))

      expect(context.evidence).toEqual([])
    }
  })

  it('keeps the author\'s message from a round that was abandoned, since the message was still said', () => {
    const abandonedRound: Conversation = {
      id: 'c1',
      rounds: [
        {
          id: 'r1',
          message: 'the question that went unanswered',
          addressed: [],
          brought: [],
          outcome: 'abandoned',
          participants: [{ participantId: 'shape', result: { kind: 'abandoned' } }],
        },
      ],
    }

    const context = compileSpecialistContext(contextInput({ role: shape, conversation: abandonedRound }))

    expect(context.history).toEqual([{ kind: 'message', text: 'the question that went unanswered' }])
  })
})

describe('compileStoryEditorContext', () => {
  it('SPEC "Context compilation": alone weighs the round\'s own readings, beside the history every call gets', () => {
    const context = compileStoryEditorContext(
      contextInput({ role: shape, message: 'a second question', conversation: conversationWithMixedHistory }),
      [{ participantId: 'compression', claim: 'a reading from this very round', note: undefined }],
    )

    expect(context.evidence).toEqual([{ participantId: 'compression', claim: 'a reading from this very round', note: undefined }])
    expect(context.history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'response', participantId: 'shape', claim: 'the entry is late', note: undefined },
    ])
  })

  it('renders the round\'s readings as their own section, distinct from the conversation so far', () => {
    const context = compileStoryEditorContext(contextInput({ role: shape, conversation: conversationWithMixedHistory }), [
      { participantId: 'compression', claim: 'the third line carries nothing', note: undefined },
    ])

    const prompt = renderPrompt(context, charter)
    expect(prompt).toContain('Readings from this round')
    expect(prompt).toContain('the third line carries nothing')
  })
})

describe('renderPrompt', () => {
  const baseContext = compileSpecialistContext(contextInput({ role: shape, draft: 'The cups sat where she left them.' }))

  it('omits an unwritten context section entirely, rather than sending an empty heading', () => {
    const prompt = renderPrompt(baseContext, charter)
    expect(prompt).not.toContain('Author context')
    expect(prompt).not.toContain('Story context')
  })

  it('includes a context section, heading and body, once the author has written it', () => {
    const context = compileSpecialistContext(
      contextInput({ role: shape, authorContext: 'prefers short sentences', storyContext: 'a flash piece about a breakup' }),
    )

    const prompt = renderPrompt(context, charter)
    expect(prompt).toContain('Author context')
    expect(prompt).toContain('prefers short sentences')
    expect(prompt).toContain('Story context')
    expect(prompt).toContain('a flash piece about a breakup')
  })

  it('states the mode\'s criteria for this specialist beside its role description', () => {
    const context = compileSpecialistContext(
      contextInput({
        role: shape,
        criteria: { attendsTo: 'Entry point, the turn, the inevitability of the close', defect: 'A middle presented as an ending' },
      }),
    )

    const roleSection = sectionOf(renderPrompt(context, charter), 'Your role')
    expect(roleSection).toContain(shape.roleDescription)
    expect(roleSection).toContain('Entry point, the turn, the inevitability of the close')
    expect(roleSection).toContain('A middle presented as an ending')
  })

  it('carries only the role description for a participant the mode names no criteria for, and no empty labels', () => {
    const prompt = renderPrompt(baseContext, charter)

    expect(prompt).toContain(shape.roleDescription)
    expect(prompt).not.toContain('you attend to')
    expect(prompt).not.toContain('defect')
  })

  it('always carries the manuscript, unexcerpted', () => {
    const prompt = renderPrompt(baseContext, charter)
    expect(prompt).toContain('The cups sat where she left them.')
  })

  it('omits the "Author\'s message" section when there is none', () => {
    const prompt = renderPrompt(baseContext, charter)
    expect(prompt).not.toContain("Author's message")
  })

  it('states that an answer is owed only when the call owes one', () => {
    const owed = compileSpecialistContext(contextInput({ role: shape, owesAnswer: true }))
    const eligible = compileSpecialistContext(contextInput({ role: shape, owesAnswer: false }))

    expect(renderPrompt(owed, charter)).toContain(charter.directQuestionOwedAnswer)
    expect(renderPrompt(eligible, charter)).not.toContain(charter.directQuestionOwedAnswer)
  })

  it('carries the reading being asked about and the author\'s clarification, never as the author\'s own message', () => {
    const context = compileSpecialistContext(
      contextInput({ role: shape, ask: { claim: 'the entry is late', note: 'by a paragraph', clarification: 'what would you cut' } }),
    )

    const prompt = renderPrompt(context, charter)
    expect(prompt).toContain('the entry is late')
    expect(prompt).toContain('by a paragraph')
    expect(prompt).toContain('what would you cut')
    expect(prompt).not.toContain("Author's message")
  })

  it('omits the "Asked for a concrete change" section for an ordinary call', () => {
    const prompt = renderPrompt(baseContext, charter)
    expect(prompt).not.toContain('Asked for a concrete change')
  })

  it('carries no clarification section when the author gave none', () => {
    const context = compileSpecialistContext(contextInput({ role: shape, ask: { claim: 'the entry is late', note: undefined, clarification: undefined } }))

    expect(renderPrompt(context, charter)).not.toContain('The author added')
  })
})
