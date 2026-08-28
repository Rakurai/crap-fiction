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
  type RejectedAttempt,
} from '../../src/server/room/context.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { CallTurns, TurnRole } from '../../src/server/model/types.js'
import { applyResultSchema } from '../../src/shared/applyResult.js'
import type { ConversationEntry } from '../../src/shared/conversationEntries.js'
import { CHARTER_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../support/roomFixtures.js'

const SHAPE: RoleDefinition = {
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
const COMPRESSION: RoleDefinition = {
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

const CHARTER = CHARTER_FIXTURE
const FRAGMENTS = PROMPT_FRAGMENTS_FIXTURE
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

const ENTRIES_WITH_MIXED_HISTORY: readonly ConversationEntry[] = [
  { id: 'e1', kind: 'authorMessage', text: 'first question', audience: [], brought: [] },
  { id: 'e2', kind: 'participantResponse', participantId: 'shape', causeId: 'e1', outcome: 'commentary', claim: 'the entry is late' },
  { id: 'e3', kind: 'participantNoComment', participantId: 'compression', causeId: 'e1' },
]

const ENTRIES_WITH_TWO_MESSAGES: readonly ConversationEntry[] = [
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

const ENTRIES_WITH_APPLICATION: readonly ConversationEntry[] = [
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
        entries: ENTRIES_WITH_TWO_MESSAGES,
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
        role: SHAPE,
        owesAnswer: true,
        message: 'does the opening earn its length',
        authorContext: 'prefers short sentences',
        storyContext: 'a flash piece about a breakup',
        draft: MANUSCRIPT,
      }),
    )
    expect(forSpecialist).toMatchObject({
      role: SHAPE,
      owesAnswer: true,
      message: 'does the opening earn its length',
      authorContext: 'prefers short sentences',
      storyContext: 'a flash piece about a breakup',
      draft: MANUSCRIPT,
    })

    const bare = compileSpecialistContext(contextInput({ role: SHAPE }))
    expect(bare.authorContext).toBeUndefined()
    expect(bare.storyContext).toBeUndefined()
    expect(compileApplyContext(applyContextInput({ entries: ENTRIES_WITH_TWO_MESSAGES })).constraint).toBeUndefined()
  })

  it('an apply reads the conversation whole, past any one response, and reports none where there is none yet', () => {
    expect(compileApplyContext(applyContextInput({ entries: ENTRIES_WITH_TWO_MESSAGES })).history).toEqual(WHOLE_CONVERSATION)
    expect(compileSpecialistContext(contextInput({ role: SHAPE, message: 'a message' })).history).toEqual([])
  })

  it('carries an application in every history, naming the participant whose recommendation it was, and never a change file', () => {
    const stricter: HistoryPolicy = 'stricter'

    expect(compileSpecialistContext(contextInput({ role: COMPRESSION, entries: ENTRIES_WITH_APPLICATION })).history).toEqual(
      WHOLE_CONVERSATION_WITH_APPLICATION,
    )
    expect(compileSpecialistContext(contextInput({ role: COMPRESSION, entries: ENTRIES_WITH_APPLICATION, policy: stricter })).history).toEqual([
      { kind: 'message', text: 'first question' },
      { kind: 'application', participant: 'Shape', claim: 'cut the second paragraph', note: 'it repeats the opening' },
      { kind: 'message', text: 'a later question' },
      { kind: 'response', participant: 'Compression', claim: 'the ending still drags', note: undefined },
    ])
    expect(compileApplyContext(applyContextInput({ entries: ENTRIES_WITH_APPLICATION })).history).toEqual(WHOLE_CONVERSATION_WITH_APPLICATION)

    const rendered = wholeOf(
      renderApplyPrompt(compileApplyContext(applyContextInput({ entries: ENTRIES_WITH_APPLICATION })), FRAGMENTS, []),
    )
    expect(rendered).not.toContain('a-change-file-with-no-file-on-disk')
  })

  it("gives a specialist every prior message and substantive response under the shared policy, and under the stricter one only its own", () => {
    const stricter: HistoryPolicy = 'stricter'

    expect(compileSpecialistContext(contextInput({ role: COMPRESSION, message: 'a second question', entries: ENTRIES_WITH_MIXED_HISTORY })).history).toEqual(
      SHARED_HISTORY,
    )
    expect(compileSpecialistContext(contextInput({ role: SHAPE, entries: ENTRIES_WITH_MIXED_HISTORY, policy: stricter })).history).toEqual(SHARED_HISTORY)
    expect(compileSpecialistContext(contextInput({ role: COMPRESSION, entries: ENTRIES_WITH_MIXED_HISTORY, policy: stricter })).history).toEqual([
      { kind: 'message', text: 'first question' },
    ])
  })

  it('carries no reading from the dispatch being formed, under either policy, because a specialist call has nowhere for one to arrive', () => {
    for (const policy of ['shared', 'stricter'] as const) {
      expect(compileSpecialistContext(contextInput({ role: SHAPE, entries: ENTRIES_WITH_MIXED_HISTORY, policy })).evidence).toEqual([])
    }
  })

  it("keeps the author's message from a dispatch that was abandoned, since the message was still said, and never invents an entry for the call it never issued", () => {
    const afterAbandonment: readonly ConversationEntry[] = [
      { id: 'e1', kind: 'authorMessage', text: 'the question that went unanswered', audience: [], brought: [] },
    ]

    expect(compileSpecialistContext(contextInput({ role: SHAPE, entries: afterAbandonment })).history).toEqual([
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

    expect(compileSpecialistContext(contextInput({ role: SHAPE, entries: entriesWithRequests })).history).toEqual(expected)
    expect(compileSpecialistContext(contextInput({ role: SHAPE, entries: entriesWithRequests, policy: 'stricter' })).history).toEqual(expected)
    expect(compileApplyContext(applyContextInput({ entries: entriesWithRequests })).history).toEqual(expected)
  })

  it('refuses to compile where the conversation names a participant it has no name for, or applies a response it does not hold', () => {
    const namingAStranger: readonly ConversationEntry[] = [
      { id: 'e1', kind: 'participantResponse', participantId: 'a-participant-with-no-name', causeId: 'e0', outcome: 'commentary', claim: 'a reading' },
    ]
    const applyingNothing: readonly ConversationEntry[] = [{ id: 'e1', kind: 'application', responseId: 'a-response-not-in-this-conversation', changeId: 'c' }]

    expect(() => compileSpecialistContext(contextInput({ role: SHAPE, entries: namingAStranger }))).toThrow(ParticipantNameUnknownError)
    expect(() => compileApplyContext(applyContextInput({ entries: namingAStranger }))).toThrow(ParticipantNameUnknownError)
    expect(() => compileSpecialistContext(contextInput({ role: SHAPE, entries: applyingNothing }))).toThrow(AppliedResponseUnknownError)
    expect(() => compileApplyContext(applyContextInput({ entries: applyingNothing }))).toThrow(AppliedResponseUnknownError)
  })

  it("the story editor alone weighs the dispatch's own readings, beside the history every call gets", () => {
    const reading = { participant: 'Compression', claim: 'a reading from this very dispatch', note: undefined }

    const context = compileStoryEditorContext(
      contextInput({ role: SHAPE, message: 'a second question', entries: ENTRIES_WITH_MIXED_HISTORY }),
      [reading],
    )

    expect(context.evidence).toEqual([reading])
    expect(context.history).toEqual(SHARED_HISTORY)
  })
})

describe('rendering a prompt', () => {
  const bareSpecialist = compileSpecialistContext(contextInput({ role: SHAPE, draft: MANUSCRIPT }))

  it('always carries the manuscript, unexcerpted, whichever call it is', () => {
    expect(wholeOf(renderPrompt(bareSpecialist, FRAGMENTS, CHARTER))).toContain(MANUSCRIPT)
    expect(
      wholeOf(renderApplyPrompt(compileApplyContext(applyContextInput({ draft: MANUSCRIPT, entries: ENTRIES_WITH_TWO_MESSAGES })), FRAGMENTS, [])),
    ).toContain(MANUSCRIPT)
  })

  it('renders a line fragment once per supplied history entry, never collapsing or duplicating them', () => {
    const applyContext = compileApplyContext(applyContextInput({ entries: ENTRIES_WITH_TWO_MESSAGES }))
    const prompt = wholeOf(renderApplyPrompt(applyContext, FRAGMENTS, []))
    const lines = sectionOf(prompt, 'FIXTURE_HISTORY_HEADING')
      .split('\n')
      .filter((line) => line.length > 0)
    expect(lines).toHaveLength(ENTRIES_WITH_TWO_MESSAGES.length)
  })

  it('carries a durable-context section, heading and body, only once the author has written one — never an empty heading', () => {
    const written = { authorContext: 'prefers short sentences', storyContext: 'a flash piece about a breakup' }

    for (const prompt of [
      wholeOf(renderPrompt(compileSpecialistContext(contextInput({ role: SHAPE, ...written })), FRAGMENTS, CHARTER)),
      wholeOf(renderApplyPrompt(compileApplyContext(applyContextInput({ ...written, entries: [] })), FRAGMENTS, [])),
    ]) {
      expect(prompt).toContain('FIXTURE_AUTHOR_CONTEXT_HEADING')
      expect(prompt).toContain('prefers short sentences')
      expect(prompt).toContain('FIXTURE_STORY_CONTEXT_HEADING')
      expect(prompt).toContain('a flash piece about a breakup')
    }

    for (const prompt of [
      wholeOf(renderPrompt(bareSpecialist, FRAGMENTS, CHARTER)),
      wholeOf(renderApplyPrompt(compileApplyContext(applyContextInput({ entries: [] })), FRAGMENTS, [])),
    ]) {
      expect(prompt).not.toContain('FIXTURE_AUTHOR_CONTEXT_HEADING')
      expect(prompt).not.toContain('FIXTURE_STORY_CONTEXT_HEADING')
    }
  })

  it("states the recommendation to apply, and the author's constraint under its own section only where there is one", () => {
    const constrained = compileApplyContext(
      applyContextInput({ recommendationClaim: 'cut the second paragraph', constraint: 'keep the last line', entries: ENTRIES_WITH_TWO_MESSAGES }),
    )
    const prompt = wholeOf(renderApplyPrompt(constrained, FRAGMENTS, []))
    expect(prompt).toContain('cut the second paragraph')
    expect(prompt).toContain('FIXTURE_CONSTRAINT_HEADING')
    expect(prompt).toContain('keep the last line')

    const unconstrained = compileApplyContext(applyContextInput({ entries: ENTRIES_WITH_TWO_MESSAGES }))
    expect(wholeOf(renderApplyPrompt(unconstrained, FRAGMENTS, []))).not.toContain('FIXTURE_CONSTRAINT_HEADING')
  })

  it('substitutes text the author supplied exactly as it was typed, and renders no section at all for one holding only whitespace', () => {
    const typed = '  keep the last line\n\tand the title'
    const withWhitespace = compileApplyContext(applyContextInput({ constraint: typed, entries: [] }))
    expect(wholeOf(renderApplyPrompt(withWhitespace, FRAGMENTS, []))).toContain(`FIXTURE_CONSTRAINT_HEADING\n\n${typed}`)

    const blank = compileApplyContext(applyContextInput({ constraint: '   \n ', entries: [] }))
    expect(wholeOf(renderApplyPrompt(blank, FRAGMENTS, []))).not.toContain('FIXTURE_CONSTRAINT_HEADING')
  })

  it('carries the reference schema for the document a context Apply targets, only where the surface has one', () => {
    const withReference = compileApplyContext(applyContextInput({ referenceSchema: 'Sections, each holding entries.', entries: [] }))
    expect(wholeOf(renderApplyPrompt(withReference, FRAGMENTS, []))).toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
    expect(wholeOf(renderApplyPrompt(withReference, FRAGMENTS, []))).toContain('Sections, each holding entries.')

    const withoutReference = compileApplyContext(applyContextInput({ entries: [] }))
    expect(wholeOf(renderApplyPrompt(withoutReference, FRAGMENTS, []))).not.toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
  })

  it('carries a reference schema to a participant under its own section, only where the compiled context was given one', () => {
    const withReference = compileSpecialistContext(contextInput({ role: SHAPE, referenceSchema: 'Sections, each holding entries.' }))
    const prompt = wholeOf(renderPrompt(withReference, FRAGMENTS, CHARTER))
    expect(prompt).toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
    expect(prompt).toContain('Sections, each holding entries.')

    const withoutReference = compileSpecialistContext(contextInput({ role: SHAPE }))
    expect(wholeOf(renderPrompt(withoutReference, FRAGMENTS, CHARTER))).not.toContain('FIXTURE_REFERENCE_SCHEMA_HEADING')
  })

  it("gives the story editor the dispatch's readings as their own section, naming the participant by display name, and no section at all where nothing substantive landed", () => {
    const withReading = compileStoryEditorContext(contextInput({ role: SHAPE, entries: ENTRIES_WITH_MIXED_HISTORY }), [
      { participant: 'Compression', claim: 'the third line carries nothing', note: undefined },
    ])
    const prompt = wholeOf(renderPrompt(withReading, FRAGMENTS, CHARTER))
    expect(prompt).toContain('FIXTURE_READINGS_HEADING')
    expect(prompt).toContain('the third line carries nothing')

    const withNothing = compileStoryEditorContext(contextInput({ role: SHAPE, entries: ENTRIES_WITH_MIXED_HISTORY }), [])
    expect(wholeOf(renderPrompt(withNothing, FRAGMENTS, CHARTER))).not.toContain('FIXTURE_READINGS_HEADING')
  })

  it("states the mode's shared description of form and scale alongside the role's own persona in the standing turn, and selects the generalist task for the generalist in the request turn", () => {
    const compiled = compileSpecialistContext(contextInput({ role: SHAPE }))
    const rendered = renderPrompt(compiled, FRAGMENTS, CHARTER)
    expect(contentOf(rendered, 'system')).toContain(MODE_DESCRIPTION)
    expect(sectionOf(contentOf(rendered, 'system'), 'FIXTURE_ROLE_HEADING')).toContain(SHAPE.persona)
    expect(contentOf(rendered, 'user')).toContain('FIXTURE_SPECIALIST_TASK')

    const generalistRole: RoleDefinition = { ...SHAPE, eligibility: 'generalist' }
    const generalist = renderPrompt(compileSpecialistContext(contextInput({ role: generalistRole })), FRAGMENTS, CHARTER)
    expect(contentOf(generalist, 'user')).toContain('FIXTURE_GENERALIST_TASK')
    expect(contentOf(generalist, 'user')).not.toContain('FIXTURE_SPECIALIST_TASK')
  })

  it('states that an answer is owed only when the call owes one', () => {
    const owed = compileSpecialistContext(contextInput({ role: SHAPE, owesAnswer: true }))
    const eligible = compileSpecialistContext(contextInput({ role: SHAPE, owesAnswer: false }))

    expect(wholeOf(renderPrompt(owed, FRAGMENTS, CHARTER))).toContain('FIXTURE_ADDRESSED_HEADING')
    expect(wholeOf(renderPrompt(eligible, FRAGMENTS, CHARTER))).not.toContain('FIXTURE_ADDRESSED_HEADING')
  })

  it("carries the reading a concrete change was asked of, and the author's clarification where there was one, never as the author's own message", () => {
    const asked = compileSpecialistContext(
      contextInput({ role: SHAPE, ask: { claim: 'the entry is late', note: 'by a paragraph', clarification: 'what would you cut' } }),
    )
    const prompt = wholeOf(renderPrompt(asked, FRAGMENTS, CHARTER))
    expect(prompt).toContain('FIXTURE_CONCRETE_CHANGE_TASK')
    expect(prompt).toContain('the entry is late')
    expect(prompt).toContain('by a paragraph')
    expect(prompt).toContain('what would you cut')
    expect(prompt).not.toContain('FIXTURE_MESSAGE_HEADING')

    const unclarified = compileSpecialistContext(
      contextInput({ role: SHAPE, ask: { claim: 'the entry is late', note: undefined, clarification: undefined } }),
    )
    expect(wholeOf(renderPrompt(unclarified, FRAGMENTS, CHARTER))).not.toContain('FIXTURE_CLARIFICATION_HEADING')

    const ordinary = wholeOf(renderPrompt(bareSpecialist, FRAGMENTS, CHARTER))
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
        renderPrompt(compileSpecialistContext(contextInput({ role: SHAPE, surface, draft: MANUSCRIPT })), FRAGMENTS, CHARTER),
    },
    {
      kind: 'generalist',
      marker: 'FIXTURE_GENERALIST_TASK',
      render: (surface: (typeof SURFACES)[number]) =>
        renderPrompt(
          compileSpecialistContext(contextInput({ role: { ...SHAPE, eligibility: 'generalist' }, surface, draft: MANUSCRIPT })),
          FRAGMENTS,
          CHARTER,
        ),
    },
    {
      kind: 'concreteChange',
      marker: 'FIXTURE_CONCRETE_CHANGE_TASK',
      render: (surface: (typeof SURFACES)[number]) =>
        renderPrompt(
          compileSpecialistContext(
            contextInput({ role: SHAPE, surface, draft: MANUSCRIPT, ask: { claim: 'the entry is late', note: undefined, clarification: undefined } }),
          ),
          FRAGMENTS,
          CHARTER,
        ),
    },
    {
      kind: 'apply',
      marker: 'FIXTURE_APPLY_TASK',
      render: (surface: (typeof SURFACES)[number]) =>
        renderApplyPrompt(compileApplyContext(applyContextInput({ surface, draft: MANUSCRIPT, entries: [] })), FRAGMENTS, []),
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
    const participant = renderPrompt(compileSpecialistContext(contextInput({ role: SHAPE })), FRAGMENTS, CHARTER)
    const application = renderApplyPrompt(compileApplyContext(applyContextInput({ entries: [] })), FRAGMENTS, [])

    expect(participant.map((turn) => turn.role)).toEqual(['system', 'user'])
    expect(application.map((turn) => turn.role)).toEqual(['system', 'user'])
  })
})

describe('the order the two turns compose in', () => {
  it('orders a participant call widest-frame to narrowest-responsibility, and its request turn task through the current material', () => {
    const context = compileSpecialistContext(
      contextInput({
        role: SHAPE,
        owesAnswer: true,
        message: 'does the opening earn its length',
        authorContext: 'prefers short sentences',
      }),
    )

    const rendered = renderPrompt(context, FRAGMENTS, CHARTER)

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

    const rendered = renderApplyPrompt(context, FRAGMENTS, [])

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

describe('the rejected attempts a correction round carries', () => {
  const applyContext = compileApplyContext(applyContextInput({ draft: MANUSCRIPT, entries: [] }))

  const firstAttempt: RejectedAttempt = {
    returned: { edits: [{ find: 'the cups', replace: 'the mugs' }] },
    verdicts: [{ outcome: 'defective', find: 'the cups', diagnosis: 'unmatched' }],
  }
  const secondAttempt: RejectedAttempt = {
    returned: { edits: [{ find: 'sat', replace: 'stood' }] },
    verdicts: [{ outcome: 'defective', find: 'sat', diagnosis: 'ambiguous' }],
  }

  it('gives each attempt as the answer the model returned in an assistant turn, in the shape it was asked to answer in, and the room\'s diagnosis in a user turn that follows it', () => {
    const rendered = renderApplyPrompt(applyContext, FRAGMENTS, [firstAttempt])

    expect(rendered.map((turn) => turn.role)).toEqual(['system', 'user', 'assistant', 'user'])
    const answer = rendered[2]
    if (answer === undefined) throw new Error('the correction carries no assistant turn')
    expect(applyResultSchema.parse(JSON.parse(answer.content))).toEqual(firstAttempt.returned)
    expect(rendered[3]?.content).toContain('FIXTURE_REJECTED_ATTEMPT_HEADING')
    expect(rendered[3]?.content).toContain('FIXTURE_EDIT_UNMATCHED the cups')
  })

  it('accumulates the pairs in the order they were rejected, and leaves the standing turn byte-identical in every round', () => {
    const first = renderApplyPrompt(applyContext, FRAGMENTS, [])
    const second = renderApplyPrompt(applyContext, FRAGMENTS, [firstAttempt])
    const third = renderApplyPrompt(applyContext, FRAGMENTS, [firstAttempt, secondAttempt])

    expect(third.map((turn) => turn.role)).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user'])
    expect(third.slice(0, 4)).toEqual(second)
    expect(second.slice(0, 2)).toEqual(first)
    expect(contentOf(second, 'system')).toBe(contentOf(first, 'system'))
    expect(contentOf(third, 'system')).toBe(contentOf(first, 'system'))
  })

  const DIAGNOSIS_CASES = [
    { diagnosis: 'unmatched', marker: 'FIXTURE_EDIT_UNMATCHED the cups' },
    { diagnosis: 'ambiguous', marker: 'FIXTURE_EDIT_AMBIGUOUS the cups' },
    { diagnosis: 'occurrenceOutOfRange', marker: 'FIXTURE_EDIT_OCCURRENCE_OUT_OF_RANGE the cups' },
    { diagnosis: 'overlapping', marker: 'FIXTURE_EDIT_OVERLAPPING the cups' },
    { diagnosis: 'emptyAnchor', marker: 'FIXTURE_EDIT_EMPTY_ANCHOR' },
  ] as const

  it.each(DIAGNOSIS_CASES)('carries the $diagnosis diagnosis as its own fragment', ({ diagnosis, marker }) => {
    const rendered = renderApplyPrompt(applyContext, FRAGMENTS, [
      { returned: { edits: [{ find: 'the cups', replace: 'the mugs' }] }, verdicts: [{ outcome: 'defective', find: 'the cups', diagnosis }] },
    ])

    expect(contentOf(rendered.slice(2), 'user')).toContain(marker)
  })

  it('says of an edit that resolved that it resolved, beside the sibling that did not', () => {
    const rendered = renderApplyPrompt(applyContext, FRAGMENTS, [
      {
        returned: {
          edits: [
            { find: 'she left', replace: 'she had left' },
            { find: 'the saucers', replace: 'the plates' },
          ],
        },
        verdicts: [
          { outcome: 'resolved', find: 'she left' },
          { outcome: 'defective', find: 'the saucers', diagnosis: 'unmatched' },
        ],
      },
    ])

    const diagnosis = contentOf(rendered.slice(2), 'user')
    expect(diagnosis).toContain('FIXTURE_EDIT_RESOLVED she left')
    expect(diagnosis).toContain('FIXTURE_EDIT_UNMATCHED the saucers')
  })
})
