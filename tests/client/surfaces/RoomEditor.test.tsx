import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CastMemberView } from '../../../src/shared/pieceViews.js'
import { RoomEditor } from '../../../src/client/RoomEditor.js'

const MEMBERS: readonly CastMemberView[] = [
  { id: 'shape', displayName: 'Shape', roleDescription: 'the shape of it', enabled: true },
  { id: 'compression', displayName: 'Compression', roleDescription: 'what earns its space', enabled: false },
]

describe('editing the room', () => {
  afterEach(cleanup)

  /**
   * The control on each row is the row's own state said aloud, which is also what makes a
   * toggle in flight legible: only that row goes quiet, the rest stay usable.
   */
  it('lists every specialist with its role description and the way it presently sits, disabling only the row a toggle is in flight for', () => {
    render(<RoomEditor members={MEMBERS} toggling={undefined} onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Shape')).toBeTruthy()
    expect(screen.getByText('the shape of it')).toBeTruthy()
    expect(screen.getByText('Compression')).toBeTruthy()
    expect(screen.getByText('what earns its space')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'enabled' }).hasAttribute('disabled')).toBe(false)

    cleanup()
    render(<RoomEditor members={MEMBERS} toggling="shape" onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'enabled' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'disabled' }).hasAttribute('disabled')).toBe(false)
  })

  it('toggles one specialist and is left, one action apiece, generating no rationale and presenting no lifecycle', () => {
    const onToggle = vi.fn()
    const onClose = vi.fn()
    render(<RoomEditor members={MEMBERS} toggling={undefined} onToggle={onToggle} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'disabled' }))
    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(onToggle).toHaveBeenCalledWith('compression')
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
