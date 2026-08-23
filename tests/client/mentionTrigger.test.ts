import { describe, expect, it } from 'vitest'
import { completeMention, mentionQuery } from '../../src/client/mentionTrigger.js'

describe('mentionQuery', () => {
  it('finds the token at the start of the message', () => {
    expect(mentionQuery('@sh', 3)).toEqual({ sigilIndex: 0, token: 'sh' })
  })

  it('finds the token after whitespace', () => {
    expect(mentionQuery('hi @sh', 6)).toEqual({ sigilIndex: 3, token: 'sh' })
  })

  it('finds no token where the sigil sits mid-word', () => {
    expect(mentionQuery('mail@sh', 7)).toBeUndefined()
  })

  it('finds no token at the second sigil of a doubled one', () => {
    expect(mentionQuery('@@shape', 7)).toBeUndefined()
  })

  it('finds no token once a space has closed it', () => {
    expect(mentionQuery('@shape is', 9)).toBeUndefined()
  })

  it('finds the token as it stands with the caret mid-token', () => {
    expect(mentionQuery('@shape', 3)).toEqual({ sigilIndex: 0, token: 'sh' })
  })

  it('finds an empty token right after the sigil', () => {
    expect(mentionQuery('@', 1)).toEqual({ sigilIndex: 0, token: '' })
  })
})

describe('completeMention', () => {
  it('replaces the token with the handle and a trailing space, caret just past it', () => {
    expect(completeMention('@sh', { sigilIndex: 0, token: 'sh' }, 'shape')).toEqual({
      value: '@shape ',
      caret: 7,
    })
  })

  it('leaves what follows the token untouched', () => {
    expect(completeMention('hi @sh does this work', { sigilIndex: 3, token: 'sh' }, 'shape')).toEqual({
      value: 'hi @shape  does this work',
      caret: 10,
    })
  })
})
