import { describe, expect, it } from 'vitest'
import type { Edit } from '../../src/shared/applyResult.js'
import { resolveEdits, type EditDefects } from '../../src/server/room/edits.js'

function textOf(target: string, edits: readonly Edit[]): string {
  const resolution = resolveEdits(target, edits)
  if (resolution.outcome !== 'resolved') throw new Error('expected the edits to resolve')
  return resolution.text
}

function defectsOf(target: string, edits: readonly Edit[]): EditDefects {
  const resolution = resolveEdits(target, edits)
  if (resolution.outcome !== 'defective') throw new Error('expected the edits to be diagnosed')
  return resolution.defects
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
  it('is a defect where it matches nothing, matches more than once with no occurrence named, or names an occurrence past the last', () => {
    expect(defectsOf('one cup', [{ find: 'two cups', replace: 'three cups' }])).toEqual({ unresolved: 1 })
    expect(defectsOf('a cup, a cup', [{ find: 'a cup', replace: 'a mug' }])).toEqual({ unresolved: 1 })
    expect(defectsOf('a cup, a cup', [{ find: 'a cup', replace: 'a mug', occurrence: 2 }])).toEqual({ unresolved: 1 })
    expect(defectsOf('one cup', [{ find: 'cup', replace: 'mug' }, { find: 'saucer', replace: 'plate' }])).toEqual({ unresolved: 1 })
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
    expect(defectsOf('aaa', [{ find: 'aa', replace: 'b', occurrence: 1 }])).toEqual({ unresolved: 1 })
  })

  it('quotes nothing only against an empty document', () => {
    expect(textOf('', [{ find: '', replace: 'the first line' }])).toBe('the first line')
    expect(defectsOf('a story already written', [{ find: '', replace: 'another story' }])).toEqual({ emptyAnchor: 1 })
  })
})

describe('two edits quoting text that overlaps', () => {
  it('diagnoses both edges of the intersection, not one of them', () => {
    expect(
      defectsOf('the second cup', [
        { find: 'the second', replace: 'the first' },
        { find: 'second cup', replace: 'second saucer' },
      ]),
    ).toEqual({ overlapping: 2 })
    expect(
      defectsOf('one cup', [
        { find: 'cup', replace: 'mug' },
        { find: 'cup', replace: 'glass' },
      ]),
    ).toEqual({ overlapping: 2 })
  })
})

describe('what a diagnosed set reports', () => {
  it('is a count of each kind, so nothing an author wrote and nothing a model quoted can reach a log line through it', () => {
    const resolution = resolveEdits('a story already written', [
      { find: 'a line nobody wrote', replace: 'a line nobody asked for' },
      { find: '', replace: 'another story entirely' },
    ])

    expect(resolution).toEqual({ outcome: 'defective', defects: { unresolved: 1, emptyAnchor: 1 } })
    expect(JSON.stringify(resolution)).not.toContain('a line nobody')
    expect(JSON.stringify(resolution)).not.toContain('another story')
    expect(JSON.stringify(resolution)).not.toContain('already written')
  })
})

describe('an edit with an empty replacement', () => {
  it('deletes what it quoted, and deleting everything leaves an empty document', () => {
    expect(textOf('cups and saucers', [{ find: ' and saucers', replace: '' }])).toBe('cups')
    expect(textOf('cups', [{ find: 'cups', replace: '' }])).toBe('')
  })
})
