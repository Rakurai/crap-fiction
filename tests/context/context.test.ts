import { describe, expect, it } from 'vitest'
import {
  compileApplyContext,
  compileSpecialistContext,
  compileStoryEditorContext,
  renderApplyPrompt,
  renderPrompt,
  AppliedResponseUnknownError,
  ParticipantNameUnknownError,
  type ApplyContextInput,
  type ContextInput,
  type HistoryPolicy,
} from '../../src/server/room/context.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { CallTurns, TurnRole } from '../../src/server/model/types.js'
import type { ConversationEntry } from '../../src/shared/conversationEntries.js'
import { CHARTER_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../support/roomFixtures.js'

const shape: RoleDefinition = {
  id: 'shape',
  handle: 'shape',
  displayName: 'Shape',
  description: 'the shape of it',
  mark: 'SH',
  persona: 'reasons about the turn',
  eligibility: 'cast',
  function: undefined,
  availability: [],
}
const compression: RoleDefinition = {
  id: 'compression',
  handle: 'compression',
  displayName: 'Compression',
  description: 'what earns its space',
  mark: 'CO',
  persona: 'reasons about omission',
  eligibility: 'cast',
  function: undefined,
  availability: [],
}

const charter = CHARTER_FIXTURE
const fragments = PROMPT_FRAGMENTS_FIXTURE
const PARTICIPANTS = new Map([
  ['shape', 'Shape'],
  ['compression', 'Compression'],
])
const MANUSCRIPT = 'The cups sat where she left them.'
const MODE_DESCRIPTION = 'A short piece read in one sitting.'

function contextInput(overrides: Partial<ContextInput> & { role: RoleDefinition }): ContextInput {
  return {
    modeDescription: MODE_DESCRIPTION,
    owesAnswer: false,
    message: undefined,
    ask: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    surface: 'draft',
    referenceSchema: undefined,
    entries: undefined,
    policy: 'shared',
    participants: PARTICIPANTS,
    ...overrides,
  }
}

function applyContextInput(overrides: Partial<ApplyContextInput> & { entries: ApplyContextInput['entries'] }): ApplyContextInput {
  return {
    modeDescription: MODE_DESCRIPTION,
    recommendationClaim: 'cut the second paragraph',
    recommendationNote: undefined,
    constraint: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    surface: 'draft',
    referenceSchema: undefined,
    participants: PARTICIPANTS,
    ...overrides,
  }
}

function wholeOf(rendered: CallTurns): string {
  return rendered.map((turn) => turn.content).join('')
}

function contentOf(rendered: CallTurns, role: TurnRole): string {
  const turn = rendered.find((candidate) => candidate.role === role)
  if (turn === undefined) throw new Error(`the rendered call carries no ${role} turn`)
  return turn.content
}

function markerIndices(text: string, markers: readonly string[]): readonly number[] {
  return markers.map((marker) => {
    const index = text.indexOf(marker)
    if (index === -1) throw new Error(`marker "${marker}" not found in "${text}"`)
    return index
  })
}

function isAscending(values: readonly number[]): boolean {
  return values.every((value, i) => i === 0 || value > (values[i - 1] as number))
}

function sectionOf(prompt: string, marker: string): string {
  const [, body] = prompt.split(`${marker}\n`)
  if (body === undefined) throw new Error(`no "${marker}" section in the prompt`)
  return body.split('\nFIXTURE_')[0] ?? body
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
  { kind: 'response', participant: 'Shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
  { kind: 'message', text: 'a later question' },
  { kind: 'response', participant: 'Compression', claim: 'the ending still drags', note: undefined },
]

const SHARED_HISTORY = [
  { kind: 'message', text: 'first question' },
  { kind: 'response', participant: 'Shape', claim: 'the entry is late', note: undefined },
]

const entriesWithApplication: readonly ConversationEntry[] = [
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
  { id: 'e3', kind: 'application', responseId: 'e2', changeId: 'a-change-file-with-no-file-on-disk' },
  { id: 'e4', kind: 'authorMessage', text: 'a later question', audience: [], brought: [] },
  { id: 'e5', kind: 'participantResponse', participantId: 'compression', causeId: 'e4', outcome: 'commentary', claim: 'the ending still drags' },
]

const WHOLE_CONVERSATION_WITH_APPLICATION = [
  { kind: 'message', text: 'first question' },
  { kind: 'response', participant: 'Shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
  { kind: 'application', participant: 'Shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
  { kind: 'message', text: 'a later question' },
  { kind: 'response', participant: 'Compression', claim: 'the ending still drags', note: undefined },
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

    const bare = compileSpecialistContext(contextInput({ role: shape }))
    expect(bare.authorContext).toBeUndefined()
    expect(bare.storyContext).toBeUndefined()
    expect(compileApplyContext(applyContextInput({ entries: entriesWithTwoMessages })).constraint).toBeUndefined()
  })

  it('an apply reads the conversation whole, past any one response, and reports none where there is none yet', () => {
    expect(compileApplyContext(applyContextInput({ entries: entriesWithTwoMessages })).history).toEqual(WHOLE_CONVERSATION)
    expect(compileSpecialistContext(contextInput({ role: shape, message: 'a message' })).history).toEqual([])
  })

  it('carries an application in every history, naming the participant whose recommendation it was, and never a change file', () => {
    const stricter: HistoryPolicy = 'stricter'

    expect(compileSpecialistContext(contextInput({ role: compression, entries: entriesWithApplication })).history).toEqual(
      WHOLE_CONVERSATION_WITH_APPLICATION,
    )
    expect(compileSpecialistContext(contextInput({ role: compression, entries: entriesWithApplication, policy: stricter })).history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'application', participant: 'Shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
      { kind: 'message', text: 'a later question' },
      { kind: 'response', participant: 'Compression', claim: 'the ending still drags', note: undefined },
    ])
    expect(compileApplyContext(applyContextInput({ entries: entriesWithApplication })).history).toEqual(WHOLE_CONVERSATION_WITH_APPLICATION)

    const rendered = wholeOf(
      renderApplyPrompt(compileApplyContext(applyContextInput({ entries: entriesWithApplication })), fragments),
    )
    expect(rendered).not.toContain('a-change-file-with-no-file-on-disk')
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

  it('carries no reading from the dispatch being formed, under either policy, because a specialist call has nowhere for one to arrive', () => {
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

  it("carries the author's request for a concrete change into every history, with the clarification where one was given", () => {
    const entriesWithRequests: readonly ConversationEntry[] = [
      { id: 'e1', kind: 'concreteChangeRequest', target: 'shape', respondingTo: 'e0' },
      { id: 'e2', kind: 'concreteChangeRequest', target: 'compression', respondingTo: 'e0', clarification: 'keep the last line' },
    ]
    const expected = [
      { kind: 'request', participant: 'Shape', clarification: undefined },
      { kind: 'request', participant: 'Compression', clarification: 'keep the last line' },
    ]

    expect(compileSpecialistContext(contextInput({ role: shape, entries: entriesWithRequests })).history).toEqual(expected)
    expect(compileSpecialistContext(contextInput({ role: shape, entries: entriesWithRequests, policy: 'stricter' })).history).toEqual(expected)
    expect(compileApplyContext(applyContextInput({ entries: entriesWithRequests })).history).toEqual(expected)
  })

  it('refuses to compile where the conversation names a participant it has no name for, or applies a response it does not hold', () => {
    const namingAStranger: readonly ConversationEntry[] = [
      { id: 'e1', kind: 'participantResponse', participantId: 'a-participant-with-no-name', causeId: 'e0', outcome: 'commentary', claim: 'a reading' },
    ]
    const applyingNothing: readonly ConversationEntry[] = [{ id: 'e1', kind: 'application', responseId: 'a-response-not-in-this-conversation', changeId: 'c' }]

    expect(() => compileSpecialistContext(contextInput({ role: shape, entries: namingAStranger }))).toThrow(ParticipantNameUnknownError)
    expect(() => compileApplyContext(applyContextInput({ entries: namingAStranger }))).toThrow(ParticipantNameUnknownError)
    expect(() => compileSpecialistContext(contextInput({ role: shape, entries: applyingNothing }))).toThrow(AppliedResponseUnknownError)
    expect(() => compileApplyContext(applyContextInput({ entries: applyingNothing }))).toThrow(AppliedResponseUnknownError)
  })

  it("the story editor alone weighs the dispatch's own readings, beside the history every call gets", () => {
    const reading = { participant: 'Compression', claim: 'a reading from this very dispatch', note: undefined }

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
    expect(wholeOf(renderPrompt(bareSpecialist, fragments, charter))).toContain(MANUSCRIPT)
    expect(
      wholeOf(renderApplyPrompt(compileApplyContext(applyContextInput({ draft: MANUSCRIPT, entries: entriesWithTwoMessages })), fragments)),
    ).toContain(MANUSCRIPT)
  })

  it('renders a line fragment once per supplied history entry, never collapsing or duplicating them', () => {
    const applyContext = compileApplyContext(applyContextInput({ entries: entriesWithTwoMessages }))
    const prompt = wholeOf(renderApplyPrompt(applyContext, fragments))
    const lines = sectionOf(prompt, 'FIXTURE_HISTORY_HEADING')
      .split('\n')
      .filter((line) => line.length > 0)
    expect(lines).toHaveLength(entriesWithTwoMessages.length)
  })

  it('carries a durable-context section, heading and body, only once the author has written one — never an empty heading', () => {
    const written = { authorContext: 'prefers short sentences', storyContext: 'a flash piece about a breakup' }

    for (const prompt of [
      wholeOf(renderPrompt(compileSpecialistContext(contextInput({ role: shape, ...written })), fragments, charter)),
      wholeOf(renderApplyPrompt(compileApplyContext(applyContextInput({ ...written, entries: [] })), fragments)),
    ]) {
      expect(prompt).toContain('FIXTURE_AUTHOR_CONTEXT_HEADING')
      expect(prompt).toContain('prefers short sentences')
      expect(prompt).toContain('FIXTURE_STORY_CONTEXT_HEADING')
      expect(prompt).toContain('a flash piece about a breakup')
    }

    for (const prompt of [
      wholeOf(renderPrompt(bareSpecialist, fragments, charter)),
      wholeOf(renderApplyPrompt(compileApplyContext(applyContextInput({ entries: [] })), fragments)),
    ]) {
      expect(prompt).not.toContain('FIXTURE_AUTHOR_CONTEXT_HEADING')
      expect(prompt).not.toContain('FIXTURE_STORY_CONTEXT_HEADING')
    }
  })

  it("states the recommendation to apply, and the author's constraint under its own section only where there is one", () => {
    const constrained = compileApplyContext(
      applyContextInput({ recommendationClaim: 'cut the second paragraph', constraint: 'keep the last line', entries: entriesWithTwoMessages }),
    )
    const prompt = wholeOf(renderApplyPrompt(constrained, fragments))
    expect(prompt).toContain('cut the second paragraph')
    expect(prompt).toContain('FIXTURE_CONSTRAINT_HEADING')
    expect(prompt).toContain('keep the last line')

    const unconstrained = compileApplyContext(applyContextInput({ entries: entriesWithTwoMessages }))
    expect(wholeOf(renderApplyPrompt(unconstrained, fragments))).not.toContain('FIXTURE_CONSTRAINT_HEADING')
  })

  it('substitutes text the author supplied exactly as it was typed, and renders no section at all for one holding only whitespace', () => {
    const typed = '  keep the last line\n\tand the title'
    const withWhitespace = compileApplyContext(applyContextInput({ constraint: typed, entries: [] }))
    expect(wholeOf(renderApplyPrompt(withWhitespace, fragments))).toContain(`FIXTURE_CONSTRAINT_HEADING\n\n${typed}`)

    const blank = compileApplyContext(applyContextInput({ constraint: '   \n ', entries: [] }))
    expect(wholeOf(renderApplyPrompt(blank, fragments))).not.toContain('FIXTURE_CONSTRAINT_HEADING')
  })

  it('carries the reference schema for the document a context Apply targets, only where the surface has one', () => {
    const withReference = compileApplyContext(applyContextInput({ referenceSchema: 'Sections, each holding entries.', entries: [] }))
    expect(wholeOf(renderApplyPrompt(withReference, fragments))).toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
    expect(wholeOf(renderApplyPrompt(withReference, fragments))).toContain('Sections, each holding entries.')

    const withoutReference = compileApplyContext(applyContextInput({ entries: [] }))
    expect(wholeOf(renderApplyPrompt(withoutReference, fragments))).not.toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
  })

  it('carries a reference schema to a participant under its own section, only where the compiled context was given one', () => {
    const withReference = compileSpecialistContext(contextInput({ role: shape, referenceSchema: 'Sections, each holding entries.' }))
    const prompt = wholeOf(renderPrompt(withReference, fragments, charter))
    expect(prompt).toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
    expect(prompt).toContain('Sections, each holding entries.')

    const withoutReference = compileSpecialistContext(contextInput({ role: shape }))
    expect(wholeOf(renderPrompt(withoutReference, fragments, charter))).not.toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
  })

  it("gives the story editor the dispatch's readings as their own section, naming the participant by display name, and no section at all where nothing substantive landed", () => {
    const withReading = compileStoryEditorContext(contextInput({ role: shape, entries: entriesWithMixedHistory }), [
      { participant: 'Compression', claim: 'the third line carries nothing', note: undefined },
    ])
    const prompt = wholeOf(renderPrompt(withReading, fragments, charter))
    expect(prompt).toContain('FIXTURE_READINGS_HEADING')
    expect(prompt).toContain('the third line carries nothing')

    const withNothing = compileStoryEditorContext(contextInput({ role: shape, entries: entriesWithMixedHistory }), [])
    expect(wholeOf(renderPrompt(withNothing, fragments, charter))).not.toContain('FIXTURE_READINGS_HEADING')
  })

  it("states the mode's shared description of form and scale alongside the role's own persona in the standing turn, and selects the generalist task for the generalist in the request turn", () => {
    const compiled = compileSpecialistContext(contextInput({ role: shape }))
    const rendered = renderPrompt(compiled, fragments, charter)
    expect(contentOf(rendered, 'system')).toContain(MODE_DESCRIPTION)
    expect(sectionOf(contentOf(rendered, 'system'), 'FIXTURE_ROLE_HEADING')).toContain(shape.persona)
    expect(contentOf(rendered, 'user')).toContain('FIXTURE_SPECIALIST_TASK')

    const generalistRole: RoleDefinition = { ...shape, eligibility: 'generalist' }
    const generalist = renderPrompt(compileSpecialistContext(contextInput({ role: generalistRole })), fragments, charter)
    expect(contentOf(generalist, 'user')).toContain('FIXTURE_GENERALIST_TASK')
    expect(contentOf(generalist, 'user')).not.toContain('FIXTURE_SPECIALIST_TASK')
  })

  it('states that an answer is owed only when the call owes one', () => {
    const owed = compileSpecialistContext(contextInput({ role: shape, owesAnswer: true }))
    const eligible = compileSpecialistContext(contextInput({ role: shape, owesAnswer: false }))

    expect(wholeOf(renderPrompt(owed, fragments, charter))).toContain('FIXTURE_ADDRESSED_HEADING')
    expect(wholeOf(renderPrompt(eligible, fragments, charter))).not.toContain('FIXTURE_ADDRESSED_HEADING')
  })

  it("carries the reading a concrete change was asked of, and the author's clarification where there was one, never as the author's own message", () => {
    const asked = compileSpecialistContext(
      contextInput({ role: shape, ask: { claim: 'the entry is late', note: 'by a paragraph', clarification: 'what would you cut' } }),
    )
    const prompt = wholeOf(renderPrompt(asked, fragments, charter))
    expect(prompt).toContain('FIXTURE_CONCRETE_CHANGE_TASK')
    expect(prompt).toContain('the entry is late')
    expect(prompt).toContain('by a paragraph')
    expect(prompt).toContain('what would you cut')
    expect(prompt).not.toContain('FIXTURE_MESSAGE_HEADING')

    const unclarified = compileSpecialistContext(
      contextInput({ role: shape, ask: { claim: 'the entry is late', note: undefined, clarification: undefined } }),
    )
    expect(wholeOf(renderPrompt(unclarified, fragments, charter))).not.toContain('FIXTURE_CLARIFICATION_HEADING')

    const ordinary = wholeOf(renderPrompt(bareSpecialist, fragments, charter))
    expect(ordinary).not.toContain('FIXTURE_READING_HEADING')
    expect(ordinary).not.toContain('FIXTURE_MESSAGE_HEADING')
  })
})

describe('the task instruction names the surface it was compiled for', () => {
  const TARGET_DOCUMENT_LABEL = { draft: 'manuscript', storyContext: 'story context', authorContext: 'author context' } as const
  const SURFACES = ['draft', 'storyContext', 'authorContext'] as const

  const TASK_CASES = [
    {
      kind: 'specialist',
      marker: 'FIXTURE_SPECIALIST_TASK',
      render: (surface: (typeof SURFACES)[number]) =>
        renderPrompt(compileSpecialistContext(contextInput({ role: shape, surface, draft: MANUSCRIPT })), fragments, charter),
    },
    {
      kind: 'generalist',
      marker: 'FIXTURE_GENERALIST_TASK',
      render: (surface: (typeof SURFACES)[number]) =>
        renderPrompt(
          compileSpecialistContext(contextInput({ role: { ...shape, eligibility: 'generalist' }, surface, draft: MANUSCRIPT })),
          fragments,
          charter,
        ),
    },
    {
      kind: 'concreteChange',
      marker: 'FIXTURE_CONCRETE_CHANGE_TASK',
      render: (surface: (typeof SURFACES)[number]) =>
        renderPrompt(
          compileSpecialistContext(
            contextInput({ role: shape, surface, draft: MANUSCRIPT, ask: { claim: 'the entry is late', note: undefined, clarification: undefined } }),
          ),
          fragments,
          charter,
        ),
    },
    {
      kind: 'apply',
      marker: 'FIXTURE_APPLY_TASK',
      render: (surface: (typeof SURFACES)[number]) =>
        renderApplyPrompt(compileApplyContext(applyContextInput({ surface, draft: MANUSCRIPT, entries: [] })), fragments),
    },
  ]

  describe.each(TASK_CASES)('the $kind task', ({ marker, render }) => {
    it.each(SURFACES)("names %s's own target document, and no other surface's", (surface) => {
      const prompt = wholeOf(render(surface))
      expect(prompt).toContain(`${marker} ${TARGET_DOCUMENT_LABEL[surface]}`)
      for (const other of SURFACES) {
        if (other !== surface) expect(prompt).not.toContain(`${marker} ${TARGET_DOCUMENT_LABEL[other]}`)
      }
      expect(prompt).toContain(MANUSCRIPT)
    })
  })
})

describe('the turns a call site sends', () => {
  it('sends the standing material as a system turn and the request as a user turn, in that order, for a participant call and for an application alike', () => {
    const participant = renderPrompt(compileSpecialistContext(contextInput({ role: shape })), fragments, charter)
    const application = renderApplyPrompt(compileApplyContext(applyContextInput({ entries: [] })), fragments)

    expect(participant.map((turn) => turn.role)).toEqual(['system', 'user'])
    expect(application.map((turn) => turn.role)).toEqual(['system', 'user'])
  })
})

describe('the order the two turns compose in', () => {
  it('orders a participant call widest-frame to narrowest-responsibility, and its request turn task through the current material', () => {
    const context = compileSpecialistContext(
      contextInput({
        role: shape,
        owesAnswer: true,
        message: 'does the opening earn its length',
        authorContext: 'prefers short sentences',
      }),
    )

    const rendered = renderPrompt(context, fragments, charter)

    expect(isAscending(markerIndices(contentOf(rendered, 'system'), [MODE_DESCRIPTION, 'FIXTURE_CHARTER_HEADING', 'FIXTURE_ROLE_HEADING']))).toBe(true)
    expect(
      isAscending(
        markerIndices(contentOf(rendered, 'user'), [
          'FIXTURE_SPECIALIST_TASK',
          'FIXTURE_DRAFT_SURFACE',
          'FIXTURE_ADDRESSED_HEADING',
          'FIXTURE_AUTHOR_CONTEXT_HEADING',
          'FIXTURE_MANUSCRIPT_HEADING',
          'FIXTURE_MESSAGE_HEADING',
        ]),
      ),
    ).toBe(true)
  })

  it('orders an operation call mode description then operation role, and its request turn task through the current material', () => {
    const context = compileApplyContext(
      applyContextInput({
        authorContext: 'prefers short sentences',
        storyContext: 'a flash piece about a breakup',
        entries: [],
      }),
    )

    const rendered = renderApplyPrompt(context, fragments)

    expect(isAscending(markerIndices(contentOf(rendered, 'system'), [MODE_DESCRIPTION, 'FIXTURE_APPLY_ROLE']))).toBe(true)
    expect(
      isAscending(
        markerIndices(contentOf(rendered, 'user'), [
          'FIXTURE_APPLY_TASK',
          'FIXTURE_DRAFT_SURFACE',
          'FIXTURE_AUTHOR_CONTEXT_HEADING',
          'FIXTURE_STORY_CONTEXT_HEADING',
          'FIXTURE_MANUSCRIPT_HEADING',
          'FIXTURE_RECOMMENDATION_HEADING',
        ]),
      ),
    ).toBe(true)
  })
})
