import { describe, expect, it } from 'vitest'
import { callSites, DuplicateCallSiteError, withAssignments } from '../../../src/server/model/callSites.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const roles: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]

describe('callSites', () => {
  /**
   * The list holds two kinds of site, and what tells them apart is that a participant is
   * somebody in the room — it has a handle and a role — while an operation is only a place a
   * model is called from.
   */
  it('lists every participant with its handle and role, followed by the two operation call sites with neither', () => {
    const sites = callSites(roles)

    expect(sites.map((site) => site.site)).toEqual(['shape', 'story-editor', 'apply', 'capture'])
    expect(sites.find((site) => site.site === 'shape')).toMatchObject({ handle: 'shape', roleDescription: 'x' })
    expect(sites.find((site) => site.site === 'apply')).toMatchObject({ handle: null, roleDescription: null })
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
