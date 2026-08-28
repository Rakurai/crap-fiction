import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RosterMemberView, StoryEditorView } from '../../src/shared/pieceViews.js'
import { RoomEditor } from '../../src/client/RoomEditor.js'

const MEMBERS: readonly RosterMemberView[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'the shape of it', mark: 'SH', ordinal: 0, enabled: true },
  { id: 'compression', handle: 'comp', displayName: 'Compression', description: 'what earns its space', mark: 'CO', ordinal: 1, enabled: false },
]

const STORY_EDITOR: StoryEditorView = {
  handle: 'editor',
  displayName: 'Story Editor',
  description: 'holds the whole of it',
  mark: 'SE',
}

describe('editing the room', () => {
  afterEach(cleanup)

  it('lists every specialist by handle with its role description and the act available on it, disabling only the row a toggle is in flight for', () => {
    render(<RoomEditor members={MEMBERS} storyEditor={STORY_EDITOR} toggling={undefined} onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('@shape')).toBeTruthy()
    expect(screen.getByText('Shape')).toBeTruthy()
    expect(screen.getByText('the shape of it')).toBeTruthy()
    expect(screen.getByText('@comp')).toBeTruthy()
    expect(screen.getByText('what earns its space')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'disable' }).hasAttribute('disabled')).toBe(false)

    cleanup()
    render(<RoomEditor members={MEMBERS} storyEditor={STORY_EDITOR} toggling="shape" onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'disable' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'enable' }).hasAttribute('disabled')).toBe(false)
  })

  it('holds the Story Editor as a member nothing can be done to', () => {
    render(<RoomEditor members={MEMBERS} storyEditor={STORY_EDITOR} toggling={undefined} onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('@editor')).toBeTruthy()
    expect(screen.getByText('holds the whole of it')).toBeTruthy()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['done', 'disable', 'enable'])
  })

  it('toggles one specialist and is left, one action apiece, generating no rationale and presenting no lifecycle', () => {
    const onToggle = vi.fn()
    const onClose = vi.fn()
    render(<RoomEditor members={MEMBERS} storyEditor={STORY_EDITOR} toggling={undefined} onToggle={onToggle} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'enable' }))
    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(onToggle).toHaveBeenCalledWith('compression')
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
