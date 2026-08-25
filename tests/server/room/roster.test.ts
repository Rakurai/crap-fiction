import { describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { CastMemberWithoutRoleError, GeneralistNotInRosterError, resolveRoster } from '../../../src/server/room/roster.js'

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

function mode(cast: ModeDescriptor['cast']): ModeDescriptor {
  return { id: 'flash', name: 'Flash', cast }
}

describe('resolving who is in the room', () => {
  /**
   * The mode names the cast and what each of them attends to; the Story Editor is whoever
   * declares itself the generalist, and so has no criteria of its own to carry. An
   * addressed-only participant belongs to neither list.
   */
  it('takes the cast and its criteria from the mode, the declared generalist, and every addressed-only participant apart from both', () => {
    const roster = resolveRoster(mode([{ id: 'shape', attendsTo: 'the arc', defect: 'a late entry' }]), [SHAPE, EDITOR, TOOLSMITH])

    expect(roster.specialists.map((role) => role.id)).toEqual(['shape'])
    expect(roster.storyEditor.id).toBe('story-editor')
    expect(roster.addressedOnly.map((role) => role.id)).toEqual(['toolsmith'])
    expect(roster.criteria.get('shape')).toEqual({ attendsTo: 'the arc', defect: 'a late entry' })
    expect(roster.criteria.get('story-editor')).toBeUndefined()
  })

  it('refuses a mode naming a cast member no role defines', () => {
    expect(() => resolveRoster(mode([{ id: 'interiority', attendsTo: 'x', defect: 'y' }]), [SHAPE, EDITOR])).toThrowError(CastMemberWithoutRoleError)
  })

  it('refuses a roster with no participant declaring itself the generalist', () => {
    expect(() => resolveRoster(mode([{ id: 'shape', attendsTo: 'x', defect: 'y' }]), [SHAPE])).toThrowError(GeneralistNotInRosterError)
  })
})
