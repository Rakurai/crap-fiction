import { describe, expect, it } from 'vitest'
import { completeMention, mentionQuery } from '../../src/client/mentionTrigger.js'

// Where a sigil counts as opening a mention at all is the shared `@handle` grammar's claim, held
// at `shared/handle.test.ts`; the one mid-word case below is this module's seam onto it.

describe('mentionQuery', () => {
  it('finds the token being typed as it stands, at the start of the message or after whitespace, including the empty one right after the sigil', () => {
    expect(mentionQuery('@sh', 3)).toEqual({ sigilIndex: 0, token: 'sh' })
    expect(mentionQuery('hi @sh', 6)).toEqual({ sigilIndex: 3, token: 'sh' })
    // As it stands: the caret is mid-token, and what follows it is not being offered on yet.
    expect(mentionQuery('@shape', 3)).toEqual({ sigilIndex: 0, token: 'sh' })
    expect(mentionQuery('@', 1)).toEqual({ sigilIndex: 0, token: '' })
  })

  it('finds no token where the sigil opened no mention, and none once a space has closed the one it opened', () => {
    expect(mentionQuery('mail@sh', 7)).toBeUndefined()
    expect(mentionQuery('@shape is', 9)).toBeUndefined()
  })
})

describe('completeMention', () => {
  it('replaces the token with the handle and a trailing space, caret just past it, leaving what follows untouched', () => {
    expect(completeMention('@sh', { sigilIndex: 0, token: 'sh' }, 'shape')).toEqual({ value: '@shape ', caret: 7 })
    expect(completeMention('hi @sh does this work', { sigilIndex: 3, token: 'sh' }, 'shape')).toEqual({
      value: 'hi @shape  does this work',
      caret: 10,
    })
  })
})
