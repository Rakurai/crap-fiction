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
import type { ConversationEntry } from '../../../src/shared/conversationEntries.js'
import { CHARTER_FIXTURE } from '../../support/roomFixtures.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'reasons about omission' }

const charter = CHARTER_FIXTURE
const MANUSCRIPT = 'The cups sat where she left them.'

function contextInput(overrides: Partial<ContextInput> & { role: RoleDefinition }): ContextInput {
  return {
    criteria: undefined,
    owesAnswer: false,
    message: undefined,
    ask: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    entries: undefined,
    policy: 'shared',
    ...overrides,
  }
}

function applyContextInput(overrides: Partial<ApplyContextInput> & { entries: ApplyContextInput['entries'] }): ApplyContextInput {
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

function captureContextInput(overrides: Partial<CaptureContextInput> = {}): CaptureContextInput {
  return {
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    entries: undefined,
    ...overrides,
  }
}

function sectionOf(prompt: string, heading: string): string {
  const [, body] = prompt.split(`## ${heading}\n`)
  if (body === undefined) throw new Error(`no "${heading}" section in the prompt`)
  return body.split('\n## ')[0] ?? body
}

const entriesWithMixedHistory: readonly ConversationEntry[] = [
  { id: 'e1', kind: 'authorMessage', text: 'first question', audience: [], brought: [] },
  { id: 'e2', kind: 'participantResponse', participantId: 'shape', causeId: 'e1', outcome: 'commentary', claim: 'the entry is late' },
  { id: 'e3', kind: 'participantNoComment', participantId: 'compression', causeId: 'e1' },
]

const entriesWithTwoMessages: readonly ConversationEntry[] = [
  { id: 'e1', kind: 'authorMessage', text: 'first question', audience: [], brought: [] },
  {
    id: 'e2',
    kind: 'participantResponse',
    participantId: 'shape',
    causeId: 'e1',
    outcome: 'applicableSuggestion',
    claim: 'cut the second paragraph',
    note: 'it repeats the opening',
  },
  { id: 'e3', kind: 'authorMessage', text: 'a later question', audience: [], brought: [] },
  { id: 'e4', kind: 'participantResponse', participantId: 'compression', causeId: 'e3', outcome: 'commentary', claim: 'the ending still drags' },
]

const WHOLE_CONVERSATION = [
  { kind: 'message', text: 'first question' },
  { kind: 'response', participantId: 'shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
  { kind: 'message', text: 'a later question' },
  { kind: 'response', participantId: 'compression', claim: 'the ending still drags', note: undefined },
]

const SHARED_HISTORY = [
  { kind: 'message', text: 'first question' },
  { kind: 'response', participantId: 'shape', claim: 'the entry is late', note: undefined },
]

describe('compiling a context', () => {
  it('carries what the author and the studio supplied through untouched, whichever call is being made', () => {
    const forApply = compileApplyContext(
      applyContextInput({
        recommendationClaim: 'cut the second paragraph',
        recommendationNote: 'it repeats the opening',
        constraint: 'keep the last line',
        authorContext: 'prefers short sentences',
        storyContext: 'a flash piece about a breakup',
        draft: MANUSCRIPT,
        entries: entriesWithTwoMessages,
      }),
    )
    expect(forApply).toMatchObject({
      recommendationClaim: 'cut the second paragraph',
      recommendationNote: 'it repeats the opening',
      constraint: 'keep the last line',
      authorContext: 'prefers short sentences',
      storyContext: 'a flash piece about a breakup',
      draft: MANUSCRIPT,
    })

    const forCapture = compileCaptureContext(
      captureContextInput({ authorContext: 'prefers short sentences', storyContext: 'a flash piece about a breakup', draft: MANUSCRIPT }),
    )
    expect(forCapture).toMatchObject({
      authorContext: 'prefers short sentences',
      storyContext: 'a flash piece about a breakup',
      draft: MANUSCRIPT,
    })

    const forSpecialist = compileSpecialistContext(
      contextInput({
        role: shape,
        owesAnswer: true,
        message: 'does the opening earn its length',
        authorContext: 'prefers short sentences',
        storyContext: 'a flash piece about a breakup',
        draft: MANUSCRIPT,
      }),
    )
    expect(forSpecialist).toMatchObject({
      role: shape,
      owesAnswer: true,
      message: 'does the opening earn its length',
      authorContext: 'prefers short sentences',
      storyContext: 'a flash piece about a breakup',
      draft: MANUSCRIPT,
    })

    // Nothing is invented for what the author never wrote.
    const bare = compileSpecialistContext(contextInput({ role: shape }))
    expect(bare.authorContext).toBeUndefined()
    expect(bare.storyContext).toBeUndefined()
    expect(compileApplyContext(applyContextInput({ entries: entriesWithTwoMessages })).constraint).toBeUndefined()
  })

  it('SPEC "Applying a recommendation": an apply and a capture read the conversation whole, past any one response, and report none where there is none yet', () => {
    expect(compileApplyContext(applyContextInput({ entries: entriesWithTwoMessages })).history).toEqual(WHOLE_CONVERSATION)
    expect(compileCaptureContext(captureContextInput({ entries: entriesWithTwoMessages })).history).toEqual(WHOLE_CONVERSATION)

    expect(compileCaptureContext(captureContextInput()).history).toEqual([])
    expect(compileSpecialistContext(contextInput({ role: shape, message: 'a message' })).history).toEqual([])
  })

  it("gives a specialist every prior message and substantive response under the shared policy, and under the stricter one only its own", () => {
    const stricter: HistoryPolicy = 'stricter'

    expect(compileSpecialistContext(contextInput({ role: compression, message: 'a second question', entries: entriesWithMixedHistory })).history).toEqual(
      SHARED_HISTORY,
    )
    expect(compileSpecialistContext(contextInput({ role: shape, entries: entriesWithMixedHistory, policy: stricter })).history).toEqual(SHARED_HISTORY)
    expect(compileSpecialistContext(contextInput({ role: compression, entries: entriesWithMixedHistory, policy: stricter })).history).toEqual([
      { kind: 'message', text: 'first question' },
    ])
  })

  it('SPEC "Context compilation": carries no reading from the dispatch being formed, under either policy, because a specialist call has nowhere for one to arrive', () => {
    for (const policy of ['shared', 'stricter'] as const) {
      expect(compileSpecialistContext(contextInput({ role: shape, entries: entriesWithMixedHistory, policy })).evidence).toEqual([])
    }
  })

  it("keeps the author's message from a dispatch that was abandoned, since the message was still said, and never invents an entry for the call it never issued", () => {
    const afterAbandonment: readonly ConversationEntry[] = [
      { id: 'e1', kind: 'authorMessage', text: 'the question that went unanswered', audience: [], brought: [] },
    ]

    expect(compileSpecialistContext(contextInput({ role: shape, entries: afterAbandonment })).history).toEqual([
      { kind: 'message', text: 'the question that went unanswered' },
    ])
  })

  it("SPEC \"Context compilation\": the story editor alone weighs the dispatch's own readings, beside the history every call gets", () => {
    const reading = { kind: 'substantive' as const, participantId: 'compression', claim: 'a reading from this very dispatch', note: undefined }

    const context = compileStoryEditorContext(
      contextInput({ role: shape, message: 'a second question', entries: entriesWithMixedHistory }),
      [reading],
    )

    expect(context.evidence).toEqual([reading])
    expect(context.history).toEqual(SHARED_HISTORY)
  })
})

describe('rendering a prompt', () => {
  const bareSpecialist = compileSpecialistContext(contextInput({ role: shape, draft: MANUSCRIPT }))

  it('always carries the manuscript, unexcerpted, whichever call it is', () => {
    expect(renderPrompt(bareSpecialist, charter)).toContain(MANUSCRIPT)
    expect(renderApplyPrompt(compileApplyContext(applyContextInput({ draft: MANUSCRIPT, entries: entriesWithTwoMessages })), charter)).toContain(MANUSCRIPT)
    expect(renderCapturePrompt(compileCaptureContext(captureContextInput({ draft: MANUSCRIPT })))).toContain(MANUSCRIPT)
  })

  it('carries a durable-context section, heading and body, only once the author has written one — never an empty heading', () => {
    const written = { authorContext: 'prefers short sentences', storyContext: 'a flash piece about a breakup' }

    for (const prompt of [
      renderPrompt(compileSpecialistContext(contextInput({ role: shape, ...written })), charter),
      renderCapturePrompt(compileCaptureContext(captureContextInput(written))),
    ]) {
      expect(prompt).toContain('Author context')
      expect(prompt).toContain('prefers short sentences')
      expect(prompt).toContain('Story context')
      expect(prompt).toContain('a flash piece about a breakup')
    }

    for (const prompt of [renderPrompt(bareSpecialist, charter), renderCapturePrompt(compileCaptureContext(captureContextInput()))]) {
      expect(prompt).not.toContain('Author context')
      expect(prompt).not.toContain('Story context')
    }
  })

  it("states the recommendation to apply, and the author's constraint under its own section only where there is one", () => {
    const constrained = compileApplyContext(
      applyContextInput({ recommendationClaim: 'cut the second paragraph', constraint: 'keep the last line', entries: entriesWithTwoMessages }),
    )
    const prompt = renderApplyPrompt(constrained, charter)
    expect(prompt).toContain('cut the second paragraph')
    expect(prompt).toContain("The author's constraint")
    expect(prompt).toContain('keep the last line')

    const unconstrained = compileApplyContext(applyContextInput({ entries: entriesWithTwoMessages }))
    expect(renderApplyPrompt(unconstrained, charter)).not.toContain("The author's constraint")
  })

  it('states the threshold asymmetry between the two capture destinations', () => {
    const prompt = renderCapturePrompt(compileCaptureContext(captureContextInput()))

    expect(prompt).toContain('story context')
    expect(prompt).toContain('author context')
    expect(prompt).toMatch(/rare/)
  })

  it("gives the story editor the dispatch's readings as their own section, a no-comment among them as an attributed craft finding rather than a tally", () => {
    const withReading = compileStoryEditorContext(contextInput({ role: shape, entries: entriesWithMixedHistory }), [
      { kind: 'substantive', participantId: 'compression', claim: 'the third line carries nothing', note: undefined },
    ])
    const prompt = renderPrompt(withReading, charter)
    expect(prompt).toContain('Specialist readings')
    expect(prompt).toContain('the third line carries nothing')

    const withNoComment = compileStoryEditorContext(contextInput({ role: shape, entries: entriesWithMixedHistory }), [
      { kind: 'noComment', participantId: 'compression' },
    ])
    expect(renderPrompt(withNoComment, charter)).toContain('compression found nothing material in its discipline.')
  })

  it("states the mode's criteria for this specialist beside its role description, and only the description where the mode names none", () => {
    const withCriteria = compileSpecialistContext(
      contextInput({
        role: shape,
        criteria: { attendsTo: 'Entry point, the turn, the inevitability of the close', defect: 'A middle presented as an ending' },
      }),
    )
    const roleSection = sectionOf(renderPrompt(withCriteria, charter), 'Your role')
    expect(roleSection).toContain(shape.roleDescription)
    expect(roleSection).toContain('Entry point, the turn, the inevitability of the close')
    expect(roleSection).toContain('A middle presented as an ending')

    const bare = renderPrompt(bareSpecialist, charter)
    expect(bare).toContain(shape.roleDescription)
    expect(bare).not.toContain('you attend to')
    expect(bare).not.toContain('defect')
  })

  it('states that an answer is owed only when the call owes one', () => {
    const owed = compileSpecialistContext(contextInput({ role: shape, owesAnswer: true }))
    const eligible = compileSpecialistContext(contextInput({ role: shape, owesAnswer: false }))

    expect(renderPrompt(owed, charter)).toContain(charter.directQuestionOwedAnswer)
    expect(renderPrompt(eligible, charter)).not.toContain(charter.directQuestionOwedAnswer)
  })

  it("carries the reading a concrete change was asked of, and the author's clarification where there was one, never as the author's own message", () => {
    const asked = compileSpecialistContext(
      contextInput({ role: shape, ask: { claim: 'the entry is late', note: 'by a paragraph', clarification: 'what would you cut' } }),
    )
    const prompt = renderPrompt(asked, charter)
    expect(prompt).toContain('the entry is late')
    expect(prompt).toContain('by a paragraph')
    expect(prompt).toContain('what would you cut')
    expect(prompt).not.toContain("Author's message")

    const unclarified = compileSpecialistContext(
      contextInput({ role: shape, ask: { claim: 'the entry is late', note: undefined, clarification: undefined } }),
    )
    expect(renderPrompt(unclarified, charter)).not.toContain('The author added')

    // An ordinary call carries neither section.
    const ordinary = renderPrompt(bareSpecialist, charter)
    expect(ordinary).not.toContain('Asked for a concrete change')
    expect(ordinary).not.toContain("Author's message")
  })
})
