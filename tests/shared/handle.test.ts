import { describe, expect, it } from 'vitest'
import { handlePattern, isHandleCharacter, opensMention } from '../../src/shared/handle.js'

const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, offset) => String.fromCharCode(32 + offset))

describe('the @handle grammar the studio agrees on', () => {
  it('carries into a token every character a handle may be made of', () => {
    const admitted = PRINTABLE_ASCII.filter((character) => handlePattern.test(`a${character}`))

    expect(admitted).not.toHaveLength(0)
    for (const character of admitted) {
      expect(isHandleCharacter(character)).toBe(true)
    }
  })

  it('opens a mention at the start of the text or after whitespace, and after nothing else', () => {
    expect(opensMention(undefined)).toBe(true)
    expect(opensMention(' ')).toBe(true)
    expect(opensMention('\n')).toBe(true)
    expect(opensMention('l')).toBe(false)
    expect(opensMention('@')).toBe(false)
    expect(opensMention('.')).toBe(false)
  })
})
