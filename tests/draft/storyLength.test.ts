import { describe, expect, it } from 'vitest'
import { countWords } from '../../src/shared/storyLength.js'

describe('countWords', () => {
  it('counts the words a reader would count, not the runs of non-whitespace', () => {
    expect(countWords("It isn't over, not by half.")).toBe(6)
  })

  it('reports nothing for a draft that is only punctuation and space', () => {
    expect(countWords('  —  \n')).toBe(0)
  })
})
