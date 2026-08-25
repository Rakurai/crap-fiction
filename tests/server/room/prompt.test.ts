import { describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import {
  assertSpecialistIndependence,
  compileApplyContext,
  compileSpecialistContext,
  renderApplyPrompt,
  renderPrompt,
  SpecialistIndependenceViolation,
  type Context,
} from '../../../src/server/room/context.js'
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

const MODE_DESCRIPTION = 'A short piece read in one sitting.'

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

describe('a participant call composes its durable and per-call halves in the specified order', () => {
  it('orders the durable half widest-frame to narrowest-responsibility, and the per-call half task through the current material, omitting a section whose value is absent', () => {
    const context = compileSpecialistContext({
      role: shape,
      modeDescription: MODE_DESCRIPTION,
      owesAnswer: true,
      message: 'does the opening earn its length',
      ask: undefined,
      authorContext: 'prefers short sentences',
      storyContext: undefined,
      draft: 'text',
      surface: 'draft',
      entries: undefined,
      policy: 'shared',
      participants: new Map(),
    })

    const { durable, perCall } = renderPrompt(context, PROMPT_FRAGMENTS_FIXTURE, CHARTER_FIXTURE)

    expect(isAscending(markerIndices(durable, [MODE_DESCRIPTION, 'FIXTURE_CHARTER_HEADING', 'FIXTURE_ROLE_HEADING']))).toBe(true)
    expect(
      isAscending(
        markerIndices(perCall, [
          'FIXTURE_SPECIALIST_TASK',
          'FIXTURE_DRAFT_SURFACE',
          'FIXTURE_ADDRESSED_HEADING',
          'FIXTURE_AUTHOR_CONTEXT_HEADING',
          'FIXTURE_MANUSCRIPT_HEADING',
          'FIXTURE_MESSAGE_HEADING',
        ]),
      ),
    ).toBe(true)

    // The story-context value was never supplied, so its section is not composed at all.
    expect(perCall).not.toContain('FIXTURE_STORY_CONTEXT_HEADING')
  })
})

describe('an operation call composes its own two halves', () => {
  it('orders the durable half mode description then operation role, and the per-call half task through the current material, omitting an absent constraint', () => {
    const context = compileApplyContext({
      modeDescription: MODE_DESCRIPTION,
      recommendationClaim: 'cut the second paragraph',
      recommendationNote: undefined,
      constraint: undefined,
      authorContext: 'prefers short sentences',
      storyContext: 'a flash piece about a breakup',
      draft: 'text',
      surface: 'draft',
      entries: [],
      participants: new Map(),
    })

    const { durable, perCall } = renderApplyPrompt(context, PROMPT_FRAGMENTS_FIXTURE)

    expect(isAscending(markerIndices(durable, [MODE_DESCRIPTION, 'FIXTURE_APPLY_ROLE']))).toBe(true)
    expect(
      isAscending(
        markerIndices(perCall, [
          'FIXTURE_APPLY_TASK',
          'FIXTURE_DRAFT_SURFACE',
          'FIXTURE_AUTHOR_CONTEXT_HEADING',
          'FIXTURE_STORY_CONTEXT_HEADING',
          'FIXTURE_MANUSCRIPT_HEADING',
          'FIXTURE_RECOMMENDATION_HEADING',
        ]),
      ),
    ).toBe(true)

    // No constraint was supplied, so its section is not composed at all.
    expect(perCall).not.toContain('FIXTURE_CONSTRAINT_HEADING')
  })
})

describe('specialist independence', () => {
  const ordinaryContext: Context = {
    role: shape,
    modeDescription: MODE_DESCRIPTION,
    owesAnswer: false,
    message: undefined,
    ask: undefined,
    authorContext: undefined,
    storyContext: undefined,
    draft: 'text',
    surface: 'draft',
    history: [],
    evidence: [],
  }

  it('accepts a compiled specialist context, which carries no evidence from the dispatch being formed', () => {
    expect(() => assertSpecialistIndependence([ordinaryContext])).not.toThrow()
  })

  it('rejects a compiled context that carries a reading from the dispatch being formed, before it is rendered', () => {
    const contaminated: Context = {
      ...ordinaryContext,
      evidence: [{ kind: 'substantive', participant: 'Compression', claim: 'a reading from this very dispatch', note: undefined }],
    }

    expect(() => assertSpecialistIndependence([contaminated])).toThrow(SpecialistIndependenceViolation)
  })
})
