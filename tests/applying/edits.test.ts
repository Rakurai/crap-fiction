import { describe, expect, it } from 'vitest'
import type { Edit } from '../../src/shared/applyResult.js'
import { diagnosisCounts, resolveEdits, type DiagnosisCounts, type EditVerdict } from '../../src/server/room/edits.js'

function textOf(target: string, edits: readonly Edit[]): string {
  const resolution = resolveEdits(target, edits)
  if (resolution.outcome !== 'resolved') throw new Error('expected the edits to resolve')
  return resolution.text
}

function verdictsOf(target: string, edits: readonly Edit[]): readonly EditVerdict[] {
  const resolution = resolveEdits(target, edits)
  if (resolution.outcome !== 'defective') throw new Error('expected the edits to be diagnosed')
  return resolution.verdicts
}

function diagnosesOf(target: string, edits: readonly Edit[]): DiagnosisCounts {
  return diagnosisCounts(verdictsOf(target, edits))
}

describe('an edit set that resolves', () => {
  it('lands as one document, leaving every byte outside the quoted spans as it was', () => {
    const target = 'She left the cups.\n\nHe counted them twice, and again.\n\n<!-- a note to herself -->\n'

    expect(textOf(target, [{ find: 'twice, and again', replace: 'twice' }])).toBe(
      'She left the cups.\n\nHe counted them twice.\n\n<!-- a note to herself -->\n',
    )
    expect(
      textOf(target, [
        { find: 'She left', replace: 'She had left' },
        { find: 'He counted', replace: 'He had counted' },
      ]),
    ).toBe('She had left the cups.\n\nHe had counted them twice, and again.\n\n<!-- a note to herself -->\n')
  })

  it('takes spans that meet without overlapping', () => {
    expect(
      textOf('two cups, one chipped', [
        { find: 'two cups', replace: 'three cups' },
        { find: ', one chipped', replace: ', two chipped' },
      ]),
    ).toBe('three cups, two chipped')
  })

  it('reads the same whatever order the edits arrive in', () => {
    const target = 'first, second, third'
    const opening: Edit = { find: 'first', replace: 'one' }
    const close: Edit = { find: 'third', replace: 'three' }

    expect(textOf(target, [opening, close])).toBe('one, second, three')
    expect(textOf(target, [close, opening])).toBe('one, second, three')
  })
})

describe('an anchor against the document as it arrived', () => {
  it('names its own defect where it matches nothing, matches more than once with no occurrence named, or names an occurrence past the last', () => {
    expect(diagnosesOf('one cup', [{ find: 'two cups', replace: 'three cups' }])).toEqual({ unmatched: 1 })
    expect(diagnosesOf('a cup, a cup', [{ find: 'a cup', replace: 'a mug' }])).toEqual({ ambiguous: 1 })
    expect(diagnosesOf('a cup, a cup', [{ find: 'a cup', replace: 'a mug', occurrence: 2 }])).toEqual({ occurrenceOutOfRange: 1 })
  })

  it('is reported alongside the siblings that resolved, each verdict carrying the anchor it quoted', () => {
    expect(
      verdictsOf('one cup', [
        { find: 'cup', replace: 'mug' },
        { find: 'saucer', replace: 'plate' },
      ]),
    ).toEqual([
      { outcome: 'resolved', find: 'cup' },
      { outcome: 'defective', find: 'saucer', diagnosis: 'unmatched' },
    ])
  })

  it('counts occurrences from the first, in the original document rather than in one a sibling edit has already changed', () => {
    expect(textOf('cup cup cup', [{ find: 'cup', replace: 'mug', occurrence: 0 }])).toBe('mug cup cup')
    expect(textOf('cup cup cup', [{ find: 'cup', replace: 'mug', occurrence: 2 }])).toBe('cup cup mug')
    expect(
      textOf('cup cup cup', [
        { find: 'cup', replace: 'mug', occurrence: 0 },
        { find: 'cup', replace: 'glass', occurrence: 1 },
      ]),
    ).toBe('mug glass cup')
  })

  it('counts a run that repeats the anchor within itself once, resuming after each match', () => {
    expect(textOf('aaa', [{ find: 'aa', replace: 'b' }])).toBe('ba')
    expect(diagnosesOf('aaa', [{ find: 'aa', replace: 'b', occurrence: 1 }])).toEqual({ occurrenceOutOfRange: 1 })
  })

  it('quotes nothing only against an empty document', () => {
    expect(textOf('', [{ find: '', replace: 'the first line' }])).toBe('the first line')
    expect(diagnosesOf('a story already written', [{ find: '', replace: 'another story' }])).toEqual({ emptyAnchor: 1 })
  })

  it('is a defect where a sibling edit quotes the very same span, an empty document written twice included', () => {
    expect(
      diagnosesOf('', [
        { find: '', replace: 'one opening' },
        { find: '', replace: 'another opening' },
      ]),
    ).toEqual({ overlapping: 2 })
    expect(
      diagnosesOf('a cup, a cup', [
        { find: 'a cup', replace: 'a mug', occurrence: 0 },
        { find: 'a cup', replace: 'a glass', occurrence: 0 },
      ]),
    ).toEqual({ overlapping: 2 })
  })
})

describe('two edits quoting text that overlaps', () => {
  it('diagnoses both edges of the intersection, not one of them', () => {
    expect(
      diagnosesOf('the second cup', [
        { find: 'the second', replace: 'the first' },
        { find: 'second cup', replace: 'second saucer' },
      ]),
    ).toEqual({ overlapping: 2 })
    expect(
      diagnosesOf('one cup', [
        { find: 'cup', replace: 'mug' },
        { find: 'cup', replace: 'glass' },
      ]),
    ).toEqual({ overlapping: 2 })
  })
})

describe('what a diagnosed set offers a log line', () => {
  it('is a count of each kind, so nothing an author wrote and nothing a model quoted can reach one through it', () => {
    const counts = diagnosesOf('a story already written', [
      { find: 'a line nobody wrote', replace: 'a line nobody asked for' },
      { find: '', replace: 'another story entirely' },
    ])

    expect(counts).toEqual({ unmatched: 1, emptyAnchor: 1 })
    expect(JSON.stringify(counts)).not.toContain('a line nobody')
    expect(JSON.stringify(counts)).not.toContain('another story')
    expect(JSON.stringify(counts)).not.toContain('already written')
  })
})

describe('an edit with an empty replacement', () => {
  it('deletes what it quoted, and deleting everything leaves an empty document', () => {
    expect(textOf('cups and saucers', [{ find: ' and saucers', replace: '' }])).toBe('cups')
    expect(textOf('cups', [{ find: 'cups', replace: '' }])).toBe('')
  })
})
