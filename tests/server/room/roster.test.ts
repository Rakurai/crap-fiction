import { describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import { GeneralistNotInRosterError, resolveRoster } from '../../../src/server/room/roster.js'

const SHAPE: RoleDefinition = {
  id: 'shape',
  handle: 'shape',
  displayName: 'Shape',
  description: 'the shape of it',
  persona: 'reasons about the shape of it',
  eligibility: 'cast',
}
const EDITOR: RoleDefinition = {
  id: 'story-editor',
  handle: 'editor',
  displayName: 'Story Editor',
  description: 'the judgment',
  persona: 'reasons about the judgment',
  eligibility: 'generalist',
}
const TOOLSMITH: RoleDefinition = {
  id: 'toolsmith',
  handle: 'toolsmith',
  displayName: 'Toolsmith',
  description: 'a tool the author reaches for by name',
  persona: 'reasons about the tool the author asked for',
  eligibility: 'addressed-only',
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
