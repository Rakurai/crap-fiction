import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextSurface } from '../../../src/client/ContextSurface.js'

afterEach(cleanup)

const BASE_PROPS = {
  surface: 'storyContext' as const,
  title: 'The Lighthouse',
  onOpenPieces: vi.fn(),
  onOpenModels: vi.fn(),
  text: 'Premise: two cups.',
  location: 'story-context.yaml',
  onChange: vi.fn(),
  referenceSchema: null,
  autosave: { state: { failed: false as const }, flush: vi.fn(), install: vi.fn() },
  onSwitchTo: vi.fn(),
  lifecycle: { retitling: false, retitleError: undefined, onRetitle: vi.fn() },
  applying: undefined,
}

describe('ContextSurface', () => {
  it('reaches the reversal through the ordinary undo keystroke', () => {
    const onReverseApplication = vi.fn(() => true)
    render(<ContextSurface {...BASE_PROPS} onReverseApplication={onReverseApplication} />)

    fireEvent.keyDown(screen.getByLabelText('Story context'), { key: 'z', ctrlKey: true })

    expect(onReverseApplication).toHaveBeenCalledTimes(1)
  })

  it('states which surface is current on the switcher', () => {
    render(<ContextSurface {...BASE_PROPS} onReverseApplication={vi.fn(() => true)} />)

    expect(screen.getByRole('button', { name: 'story' }).getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('button', { name: 'draft' }).getAttribute('aria-current')).toBe('false')
    expect(screen.getByRole('button', { name: 'author' }).getAttribute('aria-current')).toBe('false')
  })

  it('does not treat typing, or undo with a modifier, as the reversal keystroke', () => {
    const onReverseApplication = vi.fn(() => true)
    render(<ContextSurface {...BASE_PROPS} onReverseApplication={onReverseApplication} />)

    const field = screen.getByLabelText('Story context')
    fireEvent.keyDown(field, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(field, { key: 'z', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(field, { key: 'z' })

    expect(onReverseApplication).not.toHaveBeenCalled()
  })
})
