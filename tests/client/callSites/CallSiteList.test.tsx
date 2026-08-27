import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CallSiteAssignmentView } from '../../../src/shared/callSiteViews.js'
import { CallSiteList } from '../../../src/client/CallSiteList.js'

const UNASSIGNED: readonly CallSiteAssignmentView[] = [
  {
    site: 'story-editor',
    handle: 'editor',
    displayName: 'Story Editor',
    description: 'holds the whole of it',
    mark: 'SE',
    ordinal: null,
    assignment: null,
  },
]

const KNOWN = ['qwen3-30b', 'gemma-3-27b']

function chooser(): HTMLSelectElement {
  const element = screen.getByLabelText('Model for Story Editor')
  if (!(element instanceof HTMLSelectElement)) throw new Error('the model control is not a select')
  return element
}

function offered(): readonly string[] {
  return Array.from(chooser().options, (option) => option.value)
}

describe('choosing a model for a call site', () => {
  afterEach(cleanup)

  it('names the group and every entry in it, and needs no repeated label to say what the control chooses', () => {
    render(<CallSiteList heading="The room" sites={UNASSIGNED} known={KNOWN} assigning={undefined} saved={undefined} onAssign={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'The room' })).toBeTruthy()
    expect(screen.getByText('@editor')).toBeTruthy()
    expect(screen.getByText('Story Editor')).toBeTruthy()
    expect(screen.getByText('holds the whole of it')).toBeTruthy()
  })

  it('offers every model the runtime reports, showing the standing assignment as chosen even where the runtime no longer reports it', () => {
    const assigned = [{ ...UNASSIGNED[0]!, assignment: 'qwen3-30b' }]
    render(<CallSiteList heading="The room" sites={assigned} known={KNOWN} assigning={undefined} saved={undefined} onAssign={vi.fn()} />)

    expect(offered()).toEqual(KNOWN)
    expect(chooser().value).toBe('qwen3-30b')

    cleanup()
    const evicted = [{ ...UNASSIGNED[0]!, assignment: 'evicted-model' }]
    render(<CallSiteList heading="The room" sites={evicted} known={KNOWN} assigning={undefined} saved={undefined} onAssign={vi.fn()} />)

    expect(offered()).toEqual(['evicted-model', ...KNOWN])
    expect(chooser().value).toBe('evicted-model')
  })

  it('assigns the model chosen, without a second action, and says the assignment stood', () => {
    const onAssign = vi.fn()
    render(<CallSiteList heading="The room" sites={UNASSIGNED} known={KNOWN} assigning={undefined} saved={undefined} onAssign={onAssign} />)

    fireEvent.change(chooser(), { target: { value: 'gemma-3-27b' } })

    expect(onAssign).toHaveBeenCalledWith('story-editor', 'gemma-3-27b')

    cleanup()
    render(<CallSiteList heading="The room" sites={UNASSIGNED} known={KNOWN} assigning={undefined} saved="story-editor" onAssign={vi.fn()} />)

    expect(screen.getByText(/saved/i)).toBeTruthy()
  })

  it('offers nothing to choose while the runtime is unreachable, saying so, or while the site is already being assigned', () => {
    render(<CallSiteList heading="The room" sites={UNASSIGNED} known={[]} assigning={undefined} saved={undefined} onAssign={vi.fn()} />)

    expect(chooser().disabled).toBe(true)
    expect(screen.getByText(/until the runtime is reachable/)).toBeDefined()

    cleanup()
    render(<CallSiteList heading="The room" sites={UNASSIGNED} known={KNOWN} assigning="story-editor" saved={undefined} onAssign={vi.fn()} />)

    expect(chooser().disabled).toBe(true)
  })
})
