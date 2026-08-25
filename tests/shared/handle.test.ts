import { describe, expect, it } from 'vitest'
import { handlePattern, isHandleCharacter, opensMention } from '../../src/shared/handle.js'

/** Every character the studio could plausibly meet in a message the author typed. */
const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, offset) => String.fromCharCode(32 + offset))

describe('the @handle grammar the studio agrees on', () => {
  /**
   * The contract between the two halves of the grammar: what a shipped handle may be made of,
   * and what the scanners carry into a token. Widen the pattern to admit a hyphen and the
   * server would address a handle the author could never finish typing — this fails first.
   */
  it('carries into a token every character a handle may be made of', () => {
    const admitted = PRINTABLE_ASCII.filter((character) => handlePattern.test(`a${character}`))

    expect(admitted).not.toHaveLength(0)
    for (const character of admitted) {
      expect(isHandleCharacter(character)).toBe(true)
    }
  })

  /**
   * A sigil counts where it begins the message or follows whitespace, so `mail@shape.com` and the
   * second sigil of `@@shape` open nothing. Declared here once, for the server reading a message
   * and the client completing one.
   */
  it('opens a mention at the start of the text or after whitespace, and after nothing else', () => {
    expect(opensMention(undefined)).toBe(true)
    expect(opensMention(' ')).toBe(true)
    expect(opensMention('\n')).toBe(true)
    expect(opensMention('l')).toBe(false)
    expect(opensMention('@')).toBe(false)
    expect(opensMention('.')).toBe(false)
  })
})
