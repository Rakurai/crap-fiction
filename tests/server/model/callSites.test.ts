import { describe, expect, it } from 'vitest'
import { callSites, DuplicateCallSiteError, withAssignments } from '../../../src/server/model/callSites.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const roles: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]

describe('callSites', () => {
  /**
   * The list holds two kinds of site, and what tells them apart is the handle: a participant is
   * somebody in the room and is addressed by one, while an operation is a place a model is called
   * from and has none. Both say what the model there is for, because both are chosen the same way.
   */
  it('lists every participant by its handle, followed by the two operation call sites, each of which says what it is for', () => {
    const sites = callSites(roles)

    expect(sites.map((site) => site.site)).toEqual(['shape', 'story-editor', 'apply', 'capture'])
    expect(sites.find((site) => site.site === 'shape')).toMatchObject({ handle: 'shape', displayName: 'Shape', description: 'x' })

    const apply = sites.find((site) => site.site === 'apply')
    expect(apply?.handle).toBeNull()
    expect(apply?.displayName).toBe('Apply')
    expect(apply?.description).toMatch(/manuscript/)
    expect(sites.find((site) => site.site === 'capture')?.description).toMatch(/manuscript/)
  })

  it('fails when a participant id collides with an operation call site', () => {
    const colliding: readonly RoleDefinition[] = [{ id: 'apply', handle: 'apply', displayName: 'Apply', roleDescription: 'z' }]
    expect(() => callSites(colliding)).toThrowError(DuplicateCallSiteError)
  })
})

describe('withAssignments', () => {
  it('reports an assignment where one exists and null where it does not', () => {
    const sites = callSites(roles)
    const view = withAssignments(sites, new Map([['shape', 'llama-3']]))
    expect(view.find((site) => site.site === 'shape')?.assignment).toBe('llama-3')
    expect(view.find((site) => site.site === 'story-editor')?.assignment).toBeNull()
  })
})
