import { describe, expect, it } from 'vitest'
import { callSites, DuplicateCallSiteError, withAssignments } from '../../../src/server/model/callSites.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const roles: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'x', mark: 'SH', persona: 'reasons about x', eligibility: 'cast', function: undefined, availability: [] },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', description: 'y', mark: 'SE', persona: 'reasons about y', eligibility: 'generalist', function: undefined, availability: [] },
]

describe('callSites', () => {
  it('lists every participant by its handle, followed by the operation call site, which says what it is for', () => {
    const sites = callSites(roles)

    expect(sites.map((site) => site.site)).toEqual(['shape', 'story-editor', 'apply'])
    expect(sites.find((site) => site.site === 'shape')).toMatchObject({ handle: 'shape', displayName: 'Shape', description: 'x' })

    const apply = sites.find((site) => site.site === 'apply')
    expect(apply?.handle).toBeNull()
    expect(apply?.displayName).toBe('Apply')
    expect(apply?.description).toMatch(/manuscript/)
  })

  it('fails when a participant id collides with an operation call site', () => {
    const colliding: readonly RoleDefinition[] = [
      { id: 'apply', handle: 'apply', displayName: 'Apply', description: 'z', mark: 'AP', persona: 'reasons about z', eligibility: 'cast', function: undefined, availability: [] },
    ]
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
