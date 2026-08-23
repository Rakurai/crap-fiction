import { describe, expect, it } from 'vitest'
import { compileContext, renderPrompt } from '../../../src/server/room/context.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { Conversation } from '../../../src/shared/conversationViews.js'
import { CHARTER_FIXTURE } from '../../fixtures/charter.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'reasons about omission' }

const charter = CHARTER_FIXTURE

describe('compileContext', () => {
  it('carries the draft, the message and both durable contexts through untouched', () => {
    const context = compileContext({
      role: shape,
      owesAnswer: true,
      message: 'does the opening earn its length',
      authorContext: 'prefers short sentences',
      storyContext: 'a flash piece about a breakup',
      draft: 'The cups sat where she left them.',
      conversation: undefined,
      policy: 'shared',
    })

    expect(context.role).toBe(shape)
    expect(context.owesAnswer).toBe(true)
    expect(context.message).toBe('does the opening earn its length')
    expect(context.authorContext).toBe('prefers short sentences')
    expect(context.storyContext).toBe('a flash piece about a breakup')
    expect(context.draft).toBe('The cups sat where she left them.')
  })

  it('carries no author or story context when neither has been written', () => {
    const context = compileContext({
      role: shape,
      owesAnswer: false,
      message: undefined,
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: undefined,
      policy: 'shared',
    })

    expect(context.authorContext).toBeUndefined()
    expect(context.storyContext).toBeUndefined()
  })

  it('is empty of history for the first round of a conversation', () => {
    const context = compileContext({
      role: shape,
      owesAnswer: false,
      message: 'a message',
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: undefined,
      policy: 'shared',
    })

    expect(context.history).toEqual([])
  })

  const conversationWithMixedHistory: Conversation = {
    id: 'c1',
    rounds: [
      {
        id: 'r1',
        message: 'first question',
        addressed: [],
        outcome: 'settled',
        participants: [
          { participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late' } },
          { participantId: 'compression', result: { kind: 'response', outcome: 'noComment' } },
        ],
      },
    ],
  }

  it('shared history includes every prior message and every substantive response, regardless of who gave it', () => {
    const context = compileContext({
      role: compression,
      owesAnswer: false,
      message: 'a second question',
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: conversationWithMixedHistory,
      policy: 'shared',
    })

    expect(context.history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'response', participantId: 'shape', claim: 'the entry is late', note: undefined },
    ])
  })

  it('shared history omits a no-comment outcome, which is not a reading', () => {
    const context = compileContext({
      role: shape,
      owesAnswer: false,
      message: undefined,
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: conversationWithMixedHistory,
      policy: 'shared',
    })

    expect(context.history.some((entry) => entry.kind === 'response' && entry.participantId === 'compression')).toBe(false)
  })

  it('the stricter policy filters another specialist\'s unapplied historical response and keeps the participant\'s own', () => {
    const forShape = compileContext({
      role: shape,
      owesAnswer: false,
      message: undefined,
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: conversationWithMixedHistory,
      policy: 'stricter',
    })
    const forCompression = compileContext({
      role: compression,
      owesAnswer: false,
      message: undefined,
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: conversationWithMixedHistory,
      policy: 'stricter',
    })

    expect(forShape.history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'response', participantId: 'shape', claim: 'the entry is late', note: undefined },
    ])
    expect(forCompression.history).toEqual([{ kind: 'message', text: 'first question' }])
  })

  it('never contains a response from the round being formed, because that round is not in `conversation` yet', () => {
    const forShape = compileContext({
      role: shape,
      owesAnswer: false,
      message: 'a fresh round',
      authorContext: undefined,
      storyContext: undefined,
      draft: 'text',
      conversation: conversationWithMixedHistory,
      policy: 'shared',
      evidence: [{ participantId: 'compression', claim: 'a reading from this very round', note: undefined }],
    })

    expect(JSON.stringify(forShape.history)).not.toContain('a reading from this very round')
  })
})

describe('renderPrompt', () => {
  const baseContext = compileContext({
    role: shape,
    owesAnswer: false,
    message: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'The cups sat where she left them.',
    conversation: undefined,
    policy: 'shared',
  })

  it('omits an unwritten context section entirely, rather than sending an empty heading', () => {
    const prompt = renderPrompt(baseContext, charter)
    expect(prompt).not.toContain('Author context')
    expect(prompt).not.toContain('Story context')
  })

  it('includes a context section, heading and body, once the author has written it', () => {
    const context = compileContext({
      role: shape,
      owesAnswer: false,
      message: undefined,
      authorContext: 'prefers short sentences',
      storyContext: 'a flash piece about a breakup',
      draft: 'text',
      conversation: undefined,
      policy: 'shared',
    })

    const prompt = renderPrompt(context, charter)
    expect(prompt).toContain('Author context')
    expect(prompt).toContain('prefers short sentences')
    expect(prompt).toContain('Story context')
    expect(prompt).toContain('a flash piece about a breakup')
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
    const owed = compileContext({ ...contextInputFor(shape), owesAnswer: true })
    const eligible = compileContext({ ...contextInputFor(shape), owesAnswer: false })

    expect(renderPrompt(owed, charter)).toContain(charter.directQuestionOwedAnswer)
    expect(renderPrompt(eligible, charter)).not.toContain(charter.directQuestionOwedAnswer)
  })
})

function contextInputFor(role: RoleDefinition) {
  return {
    role,
    owesAnswer: false,
    message: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    conversation: undefined,
    policy: 'shared' as const,
  }
}
