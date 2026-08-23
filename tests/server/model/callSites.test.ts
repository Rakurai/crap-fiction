import { describe, expect, it } from 'vitest'
import { callSites, DuplicateCallSiteError, withAssignments } from '../../../src/server/model/callSites.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const roles: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y' },
]

describe('callSites', () => {
  it('lists every participant, followed by the two operation call sites', () => {
    expect(callSites(roles).map((site) => site.site)).toEqual(['shape', 'story-editor', 'apply', 'capture'])
  })

  it('carries a role description for a participant and none for an operation', () => {
    const sites = callSites(roles)
    expect(sites.find((site) => site.site === 'shape')?.roleDescription).toBe('x')
    expect(sites.find((site) => site.site === 'apply')?.roleDescription).toBeUndefined()
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
