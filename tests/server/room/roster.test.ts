import { describe, expect, it } from 'vitest'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { CastMemberWithoutRoleError, resolveRoster, StoryEditorNotResolvedError } from '../../../src/server/room/roster.js'

const SHAPE: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'the shape of it' }
const EDITOR: RoleDefinition = { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'the judgment' }

function mode(cast: ModeDescriptor['cast']): ModeDescriptor {
  return { id: 'flash', name: 'Flash', cast }
}

describe('resolving who is in the room', () => {
  it('takes the cast from the mode and the Story Editor from whoever the cast does not name', () => {
    const roster = resolveRoster(mode([{ id: 'shape', attendsTo: 'the arc', defect: 'a late entry' }]), [SHAPE, EDITOR])

    expect(roster.specialists.map((role) => role.id)).toEqual(['shape'])
    expect(roster.storyEditor.id).toBe('story-editor')
  })

  it('carries the mode\'s criteria for each specialist, and none for the Story Editor', () => {
    const roster = resolveRoster(mode([{ id: 'shape', attendsTo: 'the arc', defect: 'a late entry' }]), [SHAPE, EDITOR])

    expect(roster.criteria.get('shape')).toEqual({ attendsTo: 'the arc', defect: 'a late entry' })
    // Absent rather than empty: the Story Editor is no part of the cast, and a
    // blank criterion would read as one the mode wrote.
    expect(roster.criteria.get('story-editor')).toBeUndefined()
  })

  it('refuses a mode naming a cast member no role defines', () => {
    expect(() => resolveRoster(mode([{ id: 'interiority', attendsTo: 'x', defect: 'y' }]), [SHAPE, EDITOR])).toThrowError(CastMemberWithoutRoleError)
  })

  it('refuses a roster with nobody outside the cast: there would be no Story Editor', () => {
    expect(() => resolveRoster(mode([{ id: 'shape', attendsTo: 'x', defect: 'y' }]), [SHAPE])).toThrowError(StoryEditorNotResolvedError)
  })

  it('refuses a roster with more than one outside the cast: which of them judges is not stated anywhere', () => {
    const other: RoleDefinition = { id: 'interiority', handle: 'inter', displayName: 'Interiority', roleDescription: 'the inner life' }
    expect(() => resolveRoster(mode([{ id: 'shape', attendsTo: 'x', defect: 'y' }]), [SHAPE, EDITOR, other])).toThrowError(StoryEditorNotResolvedError)
  })
})
