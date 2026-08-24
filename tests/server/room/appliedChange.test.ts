import { describe, expect, it } from 'vitest'
import { computeAppliedChangeContent } from '../../../src/server/room/appliedChange.js'

describe('computeAppliedChangeContent', () => {
  it('reports the changed passage, with the unchanged prose around it, for a bounded edit', () => {
    const before = 'On the kitchen table: two cups, rinsed and set upside down on a towel. Ruth stood looking at them for a while.'
    const after = 'On the kitchen table: two cups, rinsed and set upside down on a towel.'

    const content = computeAppliedChangeContent(before, after)

    expect(content.kind).toBe('passages')
    if (content.kind !== 'passages') return
    expect(content.passages).toHaveLength(1)
    // The unchanged tail either side of the cut is what places the passage —
    // it appears on both sides, since it never changed.
    expect(content.passages[0]?.before).toContain('Ruth stood looking at them for a while.')
    expect(content.passages[0]?.after).not.toContain('Ruth stood')
    expect(content.passages[0]?.before).toContain('upside down on a towel.')
    expect(content.passages[0]?.after).toContain('upside down on a towel.')
  })

  it('reports several passages where the edit touches more than one place, each with its own context', () => {
    const before = 'The lighthouse stood on the point. Ruth walked the beach alone. The gulls circled overhead.'
    const after = 'The lighthouse leaned on the point. Ruth walked the beach alone. The gulls screamed overhead.'

    const content = computeAppliedChangeContent(before, after)

    expect(content.kind).toBe('passages')
    if (content.kind !== 'passages') return
    expect(content.passages).toHaveLength(2)
  })

  it('reports a whole rewrite, with no prose kept on either side, once a change touches most of the manuscript', () => {
    const before = 'On the kitchen table: two cups, rinsed and set upside down on a towel.'
    const after = 'She had not expected the house to still smell like the sea, or for the key to still be where it always was.'

    const content = computeAppliedChangeContent(before, after)

    expect(content).toEqual({ kind: 'rewrittenWhole' })
  })

  it('reports a whole rewrite where the draft was empty and the call produced the piece\'s first prose', () => {
    const content = computeAppliedChangeContent('', 'A first line, arriving from nothing.')
    expect(content).toEqual({ kind: 'rewrittenWhole' })
  })
})
