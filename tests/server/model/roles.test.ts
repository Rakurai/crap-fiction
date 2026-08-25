import { describe, expect, it } from 'vitest'
import { loadRoles, requireDistinctRoles, type RoleDefinition } from '../../../src/server/model/roles.js'
import { ShippedDataError } from '../../../src/server/store/index.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' }

describe('requireDistinctRoles', () => {
  /**
   * A participant is named twice over — by id, which the room addresses, and by handle, which
   * the author types — so either being shared is shipped data the studio must not start on.
   */
  it('passes a roster distinct in both its names, and fails startup naming which of them two definitions share', () => {
    const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'y' }
    expect(requireDistinctRoles([shape, compression])).toEqual([shape, compression])

    const sharingHandle: RoleDefinition = { ...shape, id: 'compression', displayName: 'Compression' }
    expect(() => requireDistinctRoles([shape, sharingHandle])).toThrowError(ShippedDataError)
    expect(() => requireDistinctRoles([shape, sharingHandle])).toThrowError(/duplicate handle/)

    const sharingId: RoleDefinition = { ...shape, handle: 'other' }
    expect(() => requireDistinctRoles([shape, sharingId])).toThrowError(/duplicate participant id/)
  })
})

describe('loadRoles', () => {
  it('parses and validates the roles shipped with the application', () => {
    expect(() => loadRoles()).not.toThrow()
  })
})
