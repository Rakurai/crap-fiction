import { describe, expect, it } from 'vitest'
import { applyProposals, toCaptureProposals } from '../../../src/server/room/capture.js'
import type { CaptureProposal, CaptureProposalValue } from '../../../src/shared/captureProposal.js'
import type { DurableContext } from '../../../src/shared/durableContext.js'

describe('toCaptureProposals', () => {
  it("gives each of the model's bare proposals its own identity", () => {
    const values: readonly CaptureProposalValue[] = [
      { destination: 'storyContext', section: 'Voice', operation: 'add', text: 'wry and close' },
      { destination: 'authorContext', section: 'Patterns disliked', operation: 'add', text: 'rhetorical questions' },
    ]

    const proposals = toCaptureProposals(values)

    expect(proposals).toHaveLength(2)
    expect(proposals[0]?.id).not.toBe(proposals[1]?.id)
    expect(proposals[0]).toMatchObject(values[0] as object)
    expect(proposals[1]).toMatchObject(values[1] as object)
  })
})

type Unaddressed<T> = T extends unknown ? Omit<T, 'destination'> : never

function proposal(value: Unaddressed<CaptureProposalValue>): CaptureProposal {
  return { ...value, destination: 'storyContext', id: 'p1' }
}

/**
 * What each operation does to the section it names, with a second entry present throughout so
 * that leaving the rest of the section alone is part of every row rather than its own test.
 * `replace` and `revise` are one behaviour here, not two: both overwrite in place.
 */
const OPERATIONS: readonly { readonly proposal: Unaddressed<CaptureProposalValue>; readonly expected: readonly string[] }[] = [
  { proposal: { section: 'Voice', operation: 'add', text: 'wry and close' }, expected: ['present tense', 'wry and close'] },
  {
    proposal: { section: 'Voice', operation: 'revise', entry: 'present tense', text: 'wry and understated' },
    expected: ['wry and understated'],
  },
  { proposal: { section: 'Voice', operation: 'replace', entry: 'present tense', text: 'blunt and plain' }, expected: ['blunt and plain'] },
  { proposal: { section: 'Voice', operation: 'remove', entry: 'present tense' }, expected: [] },
]

describe('applyProposals', () => {
  it('does what each operation names to the section it names, leaving the rest of that section as it was', () => {
    for (const { proposal: value, expected } of OPERATIONS) {
      expect(applyProposals({ Voice: ['present tense'] }, [proposal(value)])).toEqual({ Voice: expected })
    }
  })

  it('creates a section an added entry names where the context had none', () => {
    expect(applyProposals({}, [proposal({ section: 'Voice', operation: 'add', text: 'wry and close' })])).toEqual({ Voice: ['wry and close'] })
  })

  it('applies several proposals across different sections in one pass, never mutating the context it was given', () => {
    const context: DurableContext = { Voice: ['wry and close'], 'Patterns disliked': ['adverbs'] }

    const next = applyProposals(context, [
      proposal({ section: 'Voice', operation: 'remove', entry: 'wry and close' }),
      proposal({ section: 'Patterns disliked', operation: 'add', text: 'rhetorical questions' }),
    ])

    expect(next).toEqual({ Voice: [], 'Patterns disliked': ['adverbs', 'rhetorical questions'] })
    expect(context).toEqual({ Voice: ['wry and close'], 'Patterns disliked': ['adverbs'] })
  })

  /**
   * The context can have moved since the model read it, so an operation naming an entry that
   * is gone is ordinary rather than an error: a removal has nothing left to do, and a revision
   * still has text worth keeping.
   */
  it('treats an entry no longer there as no work for a remove, and as an addition for a revise', () => {
    expect(applyProposals({ Voice: ['present tense'] }, [proposal({ section: 'Voice', operation: 'remove', entry: 'wry and close' })])).toEqual({
      Voice: ['present tense'],
    })
    expect(
      applyProposals({ Voice: ['present tense'] }, [
        proposal({ section: 'Voice', operation: 'revise', entry: 'wry and close', text: 'blunt and plain' }),
      ]),
    ).toEqual({ Voice: ['present tense', 'blunt and plain'] })
  })
})
