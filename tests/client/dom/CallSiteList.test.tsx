import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CallSiteAssignmentView } from '../../../src/shared/callSiteViews.js'
import { CallSiteList } from '../../../src/client/CallSiteList.js'

const UNASSIGNED: readonly CallSiteAssignmentView[] = [
  { site: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: null, assignment: null },
]

const KNOWN = ['qwen3-30b', 'gemma-3-27b']

function chooser(): HTMLSelectElement {
  const element = screen.getByLabelText('model')
  if (!(element instanceof HTMLSelectElement)) throw new Error('the model control is not a select')
  return element
}

function offered(): readonly string[] {
  return Array.from(chooser().options, (option) => option.value)
}

describe('choosing a model for a call site', () => {
  afterEach(cleanup)

  it('offers every model the runtime reports, whatever is assigned', () => {
    const assigned = [{ ...UNASSIGNED[0]!, assignment: 'qwen3-30b' }]
    render(<CallSiteList sites={assigned} known={KNOWN} assigning={undefined} onAssign={vi.fn()} />)

    expect(offered()).toEqual(KNOWN)
    expect(chooser().value).toBe('qwen3-30b')
  })

  it('assigns the model chosen, without a second action', () => {
    const onAssign = vi.fn()
    render(<CallSiteList sites={UNASSIGNED} known={KNOWN} assigning={undefined} onAssign={onAssign} />)

    fireEvent.change(chooser(), { target: { value: 'gemma-3-27b' } })

    expect(onAssign).toHaveBeenCalledWith('story-editor', 'gemma-3-27b')
  })

  it('reassigns to a different model from an existing assignment', () => {
    const onAssign = vi.fn()
    const assigned = [{ ...UNASSIGNED[0]!, assignment: 'qwen3-30b' }]
    render(<CallSiteList sites={assigned} known={KNOWN} assigning={undefined} onAssign={onAssign} />)

    fireEvent.change(chooser(), { target: { value: 'gemma-3-27b' } })

    expect(onAssign).toHaveBeenCalledWith('story-editor', 'gemma-3-27b')
  })

  it('keeps offering an assignment the runtime no longer reports', () => {
    const assigned = [{ ...UNASSIGNED[0]!, assignment: 'evicted-model' }]
    render(<CallSiteList sites={assigned} known={KNOWN} assigning={undefined} onAssign={vi.fn()} />)

    expect(offered()).toEqual(['evicted-model', ...KNOWN])
    expect(chooser().value).toBe('evicted-model')
  })

  it('offers nothing to choose while the runtime is unreachable, and says so', () => {
    render(<CallSiteList sites={UNASSIGNED} known={[]} assigning={undefined} onAssign={vi.fn()} />)

    expect(chooser().disabled).toBe(true)
    expect(screen.getByText(/until the runtime is reachable/)).toBeDefined()
  })

  it('refuses a second choice for the site already being assigned', () => {
    render(<CallSiteList sites={UNASSIGNED} known={KNOWN} assigning={'story-editor'} onAssign={vi.fn()} />)

    expect(chooser().disabled).toBe(true)
  })
})
