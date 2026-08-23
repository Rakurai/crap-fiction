import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadRoles } from '../../../src/server/model/roles.js'
import { ShippedDataError } from '../../../src/server/store.js'

describe('loadRoles', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'studio-roles-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function write(name: string, contents: string) {
    writeFileSync(path.join(dir, name), contents, 'utf8')
  }

  it('loads a valid role definition', () => {
    write('shape.yaml', 'id: shape\nhandle: shape\ndisplayName: Shape\nroleDescription: x\n')
    expect(loadRoles(dir)).toEqual([{ id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' }])
  })

  it('fails startup, naming the file and the entry, when a role is missing a required field', () => {
    write('shape.yaml', 'id: shape\nhandle: shape\nroleDescription: x\n')
    expect(() => loadRoles(dir)).toThrowError(ShippedDataError)
    expect(() => loadRoles(dir)).toThrowError(/displayName/)
  })

  it('fails startup when a handle is not one lowercase token', () => {
    write('shape.yaml', 'id: shape\nhandle: "Shape One"\ndisplayName: Shape\nroleDescription: x\n')
    expect(() => loadRoles(dir)).toThrowError(ShippedDataError)
  })

  it('fails startup when two role definitions share a handle', () => {
    write('shape.yaml', 'id: shape\nhandle: same\ndisplayName: Shape\nroleDescription: x\n')
    write('compression.yaml', 'id: compression\nhandle: same\ndisplayName: Compression\nroleDescription: y\n')
    expect(() => loadRoles(dir)).toThrowError(ShippedDataError)
    expect(() => loadRoles(dir)).toThrowError(/duplicate handle/)
  })

  it('fails startup when no role definitions are shipped at all', () => {
    expect(() => loadRoles(dir)).toThrowError(ShippedDataError)
  })
})
