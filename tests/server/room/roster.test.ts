import { describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import { defaultCastFor, GeneralistNotInRosterError, resolveRoster, specialistsFor } from '../../../src/server/room/roster.js'

const SHAPE: RoleDefinition = {
  id: 'shape',
  handle: 'shape',
  displayName: 'Shape',
  description: 'the shape of it',
  persona: 'reasons about the shape of it',
  eligibility: 'cast',
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
  persona: 'reasons about what earns its space',
  eligibility: 'cast',
  availability: [{ mode: 'flash', surface: 'authorContext', enabledByDefault: true }],
}
const EDITOR: RoleDefinition = {
  id: 'story-editor',
  handle: 'editor',
  displayName: 'Story Editor',
  description: 'the judgment',
  persona: 'reasons about the judgment',
  eligibility: 'generalist',
  availability: [],
}
const TOOLSMITH: RoleDefinition = {
  id: 'toolsmith',
  handle: 'toolsmith',
  displayName: 'Toolsmith',
  description: 'a tool the author reaches for by name',
  persona: 'reasons about the tool the author asked for',
  eligibility: 'addressed-only',
  availability: [],
}

describe('resolving who is in the room', () => {
  /**
   * The cast is every participant declaring itself cast-eligible; the Story Editor is whoever
   * declares itself the generalist. An addressed-only participant belongs to neither list.
   */
  it('takes the cast from declared eligibility, the declared generalist, and every addressed-only participant apart from both', () => {
    const roster = resolveRoster([SHAPE, EDITOR, TOOLSMITH])

    expect(roster.specialists.map((role) => role.id)).toEqual(['shape'])
    expect(roster.storyEditor.id).toBe('story-editor')
    expect(roster.addressedOnly.map((role) => role.id)).toEqual(['toolsmith'])
  })

  it('refuses a roster with no participant declaring itself the generalist', () => {
    expect(() => resolveRoster([SHAPE])).toThrowError(GeneralistNotInRosterError)
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
