import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CaptureProposal } from '../../../src/shared/captureProposal.js'
import { ContextReview } from '../../../src/client/ContextReview.js'

const PROPOSALS: readonly CaptureProposal[] = [
  { id: 'p1', destination: 'storyContext', section: 'Premise', operation: 'add', entry: undefined, text: 'two cups, one left behind' },
  { id: 'p2', destination: 'authorContext', section: 'Voice', operation: 'remove', entry: 'overwrites dialogue tags', text: undefined },
]

describe('the context capture review', () => {
  afterEach(cleanup)

  it('groups proposals under the destination they belong to, with none approved by default', () => {
    render(<ContextReview proposals={PROPOSALS} approved={new Set()} closing={false} error={undefined} onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Story context')).toBeTruthy()
    expect(screen.getByText('Author context')).toBeTruthy()
    expect(screen.getByText('two cups, one left behind')).toBeTruthy()
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect((checkbox as HTMLInputElement).checked).toBe(false)
    }
  })

  it('shows a proposal already approved as checked', () => {
    render(
      <ContextReview proposals={PROPOSALS} approved={new Set(['p1'])} closing={false} error={undefined} onToggle={vi.fn()} onClose={vi.fn()} />,
    )

    expect((screen.getByText('two cups, one left behind').closest('label')?.querySelector('input') as HTMLInputElement).checked).toBe(true)
  })

  it('toggles one proposal by its own identity, generating no rationale', () => {
    const onToggle = vi.fn()
    render(<ContextReview proposals={PROPOSALS} approved={new Set()} closing={false} error={undefined} onToggle={onToggle} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('two cups, one left behind').closest('label')!.querySelector('input')!)

    expect(onToggle).toHaveBeenCalledWith('p1')
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('is left in one action', () => {
    const onClose = vi.fn()
    render(<ContextReview proposals={PROPOSALS} approved={new Set()} closing={false} error={undefined} onToggle={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('states nothing was proposed when the analysis returned nothing', () => {
    render(<ContextReview proposals={[]} approved={new Set()} closing={false} error={undefined} onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Nothing proposed.')).toBeTruthy()
  })

  it('states a failure that left the review open', () => {
    render(
      <ContextReview proposals={PROPOSALS} approved={new Set()} closing={false} error="storyContext: disk is full" onToggle={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.getByRole('alert').textContent).toBe('storyContext: disk is full')
  })
})
