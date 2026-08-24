import { describe, expect, it } from 'vitest'
import { loadModes, selectSingleMode, type ModeDescriptor } from '../../src/server/modes.js'
import { ShippedDataError } from '../../src/server/store/index.js'

const flash: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [{ id: 'shape', attendsTo: 'x', defect: 'y' }],
}

describe('selectSingleMode', () => {
  it('resolves the one shipped mode descriptor', () => {
    expect(selectSingleMode([flash])).toEqual(flash)
  })

  it('fails startup when more than one mode is shipped', () => {
    expect(() => selectSingleMode([flash, { ...flash, id: 'epic', name: 'Epic' }])).toThrowError(ShippedDataError)
    expect(() => selectSingleMode([flash, { ...flash, id: 'epic', name: 'Epic' }])).toThrowError(/found 2/)
  })

  it('fails startup when no mode descriptors are shipped at all', () => {
    expect(() => selectSingleMode([])).toThrowError(ShippedDataError)
  })
})

describe('loadModes', () => {
  it('parses and validates the mode shipped with the application', () => {
    expect(() => loadModes()).not.toThrow()
  })
})
