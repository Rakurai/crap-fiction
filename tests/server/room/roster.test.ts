import { describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import { defaultCastFor, InterviewerNotInRosterError, resolveRoster, specialistsFor } from '../../../src/server/room/roster.js'
import { INTERVIEWER_FIXTURE, INTERVIEWER_INVOCATION_FIXTURE } from '../../support/roomFixtures.js'

const SHAPE: RoleDefinition = {
  id: 'shape',
  handle: 'shape',
  displayName: 'Shape',
  description: 'the shape of it',
  mark: 'SH',
  persona: 'reasons about the shape of it',
  eligibility: 'cast',
  function: undefined,
  availability: [
    { mode: 'flash', surface: 'draft', enabledByDefault: true },
    { mode: 'epic', surface: 'draft', enabledByDefault: false },
  ],
}
const COMPRESSION: RoleDefinition = {
  id: 'compression',
  handle: 'compression',
  displayName: 'Compression',
  description: 'what earns its space',
  mark: 'CO',
  persona: 'reasons about what earns its space',
  eligibility: 'cast',
  function: undefined,
  availability: [{ mode: 'flash', surface: 'authorContext', enabledByDefault: true }],
}
const EDITOR: RoleDefinition = {
  id: 'story-editor',
  handle: 'editor',
  displayName: 'Story Editor',
  description: 'the judgment',
  mark: 'ED',
  persona: 'reasons about the judgment',
  eligibility: 'generalist',
  function: undefined,
  availability: [],
}
const TOOLSMITH: RoleDefinition = {
  id: 'toolsmith',
  handle: 'toolsmith',
  displayName: 'Toolsmith',
  description: 'a tool the author reaches for by name',
  mark: 'TO',
  persona: 'reasons about the tool the author asked for',
  eligibility: 'addressed-only',
  function: undefined,
  availability: [],
}

describe('resolving who is in the room', () => {
  it('takes the cast from declared eligibility, the declared generalist, and every addressed-only participant apart from both', () => {
    const roster = resolveRoster([SHAPE, EDITOR, TOOLSMITH, INTERVIEWER_FIXTURE])

    expect(roster.specialists.map((role) => role.id)).toEqual(['shape'])
    expect(roster.storyEditor.id).toBe('story-editor')
    expect(roster.addressedOnly.map((role) => role.id)).toEqual(['toolsmith', INTERVIEWER_FIXTURE.id])
  })

  it('reads the interviewer from whichever participant declares the function, invocation and all', () => {
    const roster = resolveRoster([SHAPE, EDITOR, TOOLSMITH, INTERVIEWER_FIXTURE])

    expect(roster.interviewer.role.id).toBe(INTERVIEWER_FIXTURE.id)
    expect(roster.interviewer.invocation).toBe(INTERVIEWER_INVOCATION_FIXTURE)
  })

  it('refuses a role set in which no participant declares the interviewer function', () => {
    expect(() => resolveRoster([SHAPE, EDITOR, TOOLSMITH])).toThrowError(InterviewerNotInRosterError)
  })
})

describe("assigning cast ordinals from the full roster's load order", () => {
  it('gives every cast participant its position among the loaded roles, unmoved by which mode-and-surface view filters it out', () => {
    const roster = resolveRoster([SHAPE, COMPRESSION, EDITOR, TOOLSMITH, INTERVIEWER_FIXTURE])

    expect(roster.specialistOrdinals.get('shape')).toBe(0)
    expect(roster.specialistOrdinals.get('compression')).toBe(1)

    // Shape is unavailable for the authorContext surface, so this view excludes it — but that
    // does not shift compression's recorded ordinal to fill the gap.
    expect(specialistsFor(roster.specialists, 'flash', 'authorContext').map((role) => role.id)).toEqual(['compression'])
    expect(roster.specialistOrdinals.get('compression')).toBe(1)
  })
})

describe('deriving a mode-and-surface roster from declared availability', () => {
  const specialists = [SHAPE, COMPRESSION]

  it('offers only the specialists available for the mode and surface asked about, and their default-enabled subset', () => {
    expect(specialistsFor(specialists, 'flash', 'draft').map((role) => role.id)).toEqual(['shape'])
    expect(defaultCastFor(specialists, 'flash', 'draft')).toEqual(['shape'])

    expect(specialistsFor(specialists, 'epic', 'draft').map((role) => role.id)).toEqual(['shape'])
    expect(defaultCastFor(specialists, 'epic', 'draft')).toEqual([])

    expect(specialistsFor(specialists, 'flash', 'authorContext').map((role) => role.id)).toEqual(['compression'])
    expect(specialistsFor(specialists, 'novella', 'draft')).toEqual([])
  })
})
