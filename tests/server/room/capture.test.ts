import { describe, expect, it } from 'vitest'
import { applyProposals, toCaptureProposals } from '../../../src/server/room/capture.js'
import type { CaptureProposal, CaptureProposalValue } from '../../../src/shared/captureProposal.js'

describe('toCaptureProposals', () => {
  it('gives each of the model\'s bare proposals its own identity', () => {
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

function proposal(overrides: Partial<CaptureProposal> & Pick<CaptureProposal, 'section' | 'operation'>): CaptureProposal {
  return { id: 'p1', destination: 'storyContext', entry: undefined, text: undefined, ...overrides }
}

describe('applyProposals', () => {
  it('appends an added entry to the section it names, creating the section if it did not exist', () => {
    const next = applyProposals({}, [proposal({ section: 'Voice', operation: 'add', text: 'wry and close' })])

    expect(next).toEqual({ Voice: ['wry and close'] })
  })

  it('overwrites the named entry in place on revise, leaving the rest of the section untouched', () => {
    const context = { Voice: ['wry and close', 'present tense'] }

    const next = applyProposals(context, [proposal({ section: 'Voice', operation: 'revise', entry: 'wry and close', text: 'wry and understated' })])

    expect(next).toEqual({ Voice: ['wry and understated', 'present tense'] })
  })

  it('overwrites the named entry in place on replace, the same way revise does', () => {
    const context = { Voice: ['wry and close'] }

    const next = applyProposals(context, [proposal({ section: 'Voice', operation: 'replace', entry: 'wry and close', text: 'blunt and plain' })])

    expect(next).toEqual({ Voice: ['blunt and plain'] })
  })

  it('drops the named entry on remove, leaving the rest of the section untouched', () => {
    const context = { Voice: ['wry and close', 'present tense'] }

    const next = applyProposals(context, [proposal({ section: 'Voice', operation: 'remove', entry: 'wry and close' })])

    expect(next).toEqual({ Voice: ['present tense'] })
  })

  it('applies several proposals across different sections in one pass', () => {
    const context = { Voice: ['wry and close'], 'Patterns disliked': ['adverbs'] }

    const next = applyProposals(context, [
      proposal({ section: 'Voice', operation: 'remove', entry: 'wry and close' }),
      proposal({ section: 'Patterns disliked', operation: 'add', text: 'rhetorical questions' }),
    ])

    expect(next).toEqual({ Voice: [], 'Patterns disliked': ['adverbs', 'rhetorical questions'] })
  })

  it('leaves the section untouched when a remove names an entry no longer there', () => {
    const context = { Voice: ['present tense'] }

    const next = applyProposals(context, [proposal({ section: 'Voice', operation: 'remove', entry: 'wry and close' })])

    expect(next).toEqual({ Voice: ['present tense'] })
  })

  it('falls back to adding the proposed text when a revise names an entry no longer there', () => {
    const context = { Voice: ['present tense'] }

    const next = applyProposals(context, [proposal({ section: 'Voice', operation: 'revise', entry: 'wry and close', text: 'blunt and plain' })])

    expect(next).toEqual({ Voice: ['present tense', 'blunt and plain'] })
  })

  it('never mutates the context it was given', () => {
    const context = { Voice: ['wry and close'] }

    applyProposals(context, [proposal({ section: 'Voice', operation: 'add', text: 'present tense' })])

    expect(context).toEqual({ Voice: ['wry and close'] })
  })
})
