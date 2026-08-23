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
  it('resolves the mode actually shipped with the application', () => {
    const mode = loadModes()
    expect(mode.id).toBe('flash')
    expect(mode.cast.length).toBeGreaterThan(0)
    for (const specialist of mode.cast) {
      expect(specialist.attendsTo.length).toBeGreaterThan(0)
      expect(specialist.defect.length).toBeGreaterThan(0)
    }
  })
})
