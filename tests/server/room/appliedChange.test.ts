import { describe, expect, it } from 'vitest'
import { computeAppliedChangeContent } from '../../../src/server/room/appliedChange.js'

describe('computeAppliedChangeContent', () => {
  it('reports one passage per place a bounded edit touches, each carrying the unchanged prose around it', () => {
    const before = 'On the kitchen table: two cups, rinsed and set upside down on a towel. Ruth stood looking at them for a while.'
    const after = 'On the kitchen table: two cups, rinsed and set upside down on a towel.'

    const content = computeAppliedChangeContent(before, after)

    expect(content.kind).toBe('passages')
    if (content.kind !== 'passages') return
    expect(content.passages).toHaveLength(1)
    expect(content.passages[0]?.before).toContain('Ruth stood looking at them for a while.')
    expect(content.passages[0]?.after).not.toContain('Ruth stood')
    expect(content.passages[0]?.before).toContain('upside down on a towel.')
    expect(content.passages[0]?.after).toContain('upside down on a towel.')

    const twoPlaces = computeAppliedChangeContent(
      'The lighthouse stood on the point. Ruth walked the beach alone. The gulls circled overhead.',
      'The lighthouse leaned on the point. Ruth walked the beach alone. The gulls screamed overhead.',
    )

    expect(twoPlaces.kind).toBe('passages')
    if (twoPlaces.kind !== 'passages') return
    expect(twoPlaces.passages).toHaveLength(2)
  })

  it('reports a whole rewrite where a change kept no prose on either side, including a draft that was empty', () => {
    const replaced = computeAppliedChangeContent(
      'On the kitchen table: two cups, rinsed and set upside down on a towel.',
      'She had not expected the house to still smell like the sea, or for the key to still be where it always was.',
    )

    expect(replaced).toEqual({ kind: 'rewrittenWhole' })
    expect(computeAppliedChangeContent('', 'A first line, arriving from nothing.')).toEqual({ kind: 'rewrittenWhole' })
  })
})
