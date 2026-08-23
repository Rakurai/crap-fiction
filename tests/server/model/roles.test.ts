import { describe, expect, it } from 'vitest'
import { loadRoles, requireDistinctRoles, type RoleDefinition } from '../../../src/server/model/roles.js'
import { ShippedDataError } from '../../../src/server/store/index.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' }

describe('requireDistinctRoles', () => {
  it('passes a roster whose ids and handles are all distinct', () => {
    const compression: RoleDefinition = {
      id: 'compression',
      handle: 'compression',
      displayName: 'Compression',
      roleDescription: 'y',
    }
    expect(requireDistinctRoles([shape, compression])).toEqual([shape, compression])
  })

  it('fails startup when two role definitions share a handle', () => {
    const other: RoleDefinition = { ...shape, id: 'compression', displayName: 'Compression' }
    expect(() => requireDistinctRoles([shape, other])).toThrowError(ShippedDataError)
    expect(() => requireDistinctRoles([shape, other])).toThrowError(/duplicate handle/)
  })

  it('fails startup when two role definitions share an id', () => {
    const other: RoleDefinition = { ...shape, handle: 'other' }
    expect(() => requireDistinctRoles([shape, other])).toThrowError(/duplicate participant id/)
  })
})

describe('loadRoles', () => {
  it('loads the roles actually shipped with the application, each with a single-token handle', () => {
    const roles = loadRoles()
    expect(roles.length).toBeGreaterThan(0)
    for (const role of roles) {
      expect(role.handle).toMatch(/^[a-z][a-z0-9]*$/)
      expect(role.displayName.length).toBeGreaterThan(0)
      expect(role.roleDescription.length).toBeGreaterThan(0)
    }
  })
})
