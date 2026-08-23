import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CallSiteAssignmentView } from '../../../src/shared/callSiteViews.js'
import { CallSiteList } from '../../../src/client/CallSiteList.js'

const SITES: readonly CallSiteAssignmentView[] = [
  { site: 'story-editor', displayName: 'Story Editor', roleDescription: null, assignment: null },
]

const KNOWN = ['qwen3-30b', 'gemma-3-27b']

function options(): readonly string[] {
  return Array.from(document.querySelectorAll('datalist option'), (option) => option.getAttribute('value') ?? '')
}

describe('naming a model for a call site', () => {
  afterEach(cleanup)

  it('offers what the runtime reports, without the author typing one', () => {
    render(<CallSiteList sites={SITES} known={KNOWN} assigning={undefined} onAssign={vi.fn()} />)

    expect(options()).toEqual(KNOWN)
    expect(screen.getByLabelText('model').getAttribute('list')).toBe('known-models-story-editor')
  })

  it('still assigns a model the runtime does not report', () => {
    const onAssign = vi.fn()
    render(<CallSiteList sites={SITES} known={KNOWN} assigning={undefined} onAssign={onAssign} />)

    fireEvent.change(screen.getByLabelText('model'), { target: { value: 'not-downloaded-yet' } })
    fireEvent.click(screen.getByRole('button', { name: 'assign' }))

    expect(onAssign).toHaveBeenCalledWith('story-editor', 'not-downloaded-yet')
  })

  it('says something when nothing was named, rather than doing nothing', () => {
    const onAssign = vi.fn()
    render(<CallSiteList sites={SITES} known={KNOWN} assigning={undefined} onAssign={onAssign} />)

    fireEvent.click(screen.getByRole('button', { name: 'assign' }))

    expect(onAssign).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Name a model to assign.')
  })

  it('offers nothing with the runtime unreachable, and the field still takes a name', () => {
    const onAssign = vi.fn()
    render(<CallSiteList sites={SITES} known={[]} assigning={undefined} onAssign={onAssign} />)

    expect(options()).toEqual([])

    fireEvent.change(screen.getByLabelText('model'), { target: { value: 'qwen3-30b' } })
    fireEvent.click(screen.getByRole('button', { name: 'assign' }))

    expect(onAssign).toHaveBeenCalledWith('story-editor', 'qwen3-30b')
  })
})
