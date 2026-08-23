import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadModes } from '../../src/server/modes.js'
import { ShippedDataError } from '../../src/server/store.js'

describe('loadModes', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'studio-modes-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads a valid mode descriptor', () => {
    writeFileSync(
      path.join(dir, 'flash.yaml'),
      'id: flash\nname: Flash\ncast:\n  - id: shape\n    attendsTo: x\n    defect: y\n',
      'utf8',
    )
    const modes = loadModes(dir)
    expect(modes).toEqual([{ id: 'flash', name: 'Flash', cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }] }])
  })

  it('fails startup, naming the file and the entry, when a mode is missing a required field', () => {
    writeFileSync(path.join(dir, 'broken.yaml'), 'id: flash\ncast:\n  - id: shape\n    attendsTo: x\n    defect: y\n', 'utf8')
    expect(() => loadModes(dir)).toThrowError(ShippedDataError)
    expect(() => loadModes(dir)).toThrowError(/name/)
  })

  it('fails startup when no mode descriptors are shipped at all', () => {
    expect(() => loadModes(dir)).toThrowError(ShippedDataError)
  })

  it('fails startup when a cast entry is missing its criteria', () => {
    writeFileSync(path.join(dir, 'flash.yaml'), 'id: flash\nname: Flash\ncast:\n  - id: shape\n', 'utf8')
    expect(() => loadModes(dir)).toThrowError(ShippedDataError)
  })
})
