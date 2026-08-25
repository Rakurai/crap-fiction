import { describe, expect, it } from 'vitest'
import { loadModes, selectSingleMode, type ModeDescriptor } from '../../src/server/modes.js'
import { ShippedDataError } from '../../src/server/store/index.js'

const flash: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in a few minutes.',
}

describe('selectSingleMode', () => {
  it('resolves the one shipped mode descriptor, and fails startup on any other number of them', () => {
    expect(selectSingleMode([flash])).toEqual(flash)

    const two = [flash, { ...flash, id: 'epic', displayName: 'Epic' }]
    expect(() => selectSingleMode(two)).toThrowError(ShippedDataError)
    expect(() => selectSingleMode(two)).toThrowError(/found 2/)
    expect(() => selectSingleMode([])).toThrowError(ShippedDataError)
  })
})

describe('loadModes', () => {
  it('parses and validates the mode shipped with the application', () => {
    expect(() => loadModes()).not.toThrow()
  })
})
