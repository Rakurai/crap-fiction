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

  it('lists every specialist with its role description, whichever way it presently sits', () => {
    render(<RoomEditor members={MEMBERS} toggling={undefined} onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByText('Shape')).toBeTruthy()
    expect(screen.getByText('the shape of it')).toBeTruthy()
    expect(screen.getByText('Compression')).toBeTruthy()
    expect(screen.getByText('what earns its space')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'enabled' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'disabled' })).toBeTruthy()
  })

  it('toggles one specialist in one action, generating no rationale and presenting no lifecycle', () => {
    const onToggle = vi.fn()
    render(<RoomEditor members={MEMBERS} toggling={undefined} onToggle={onToggle} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'disabled' }))

    expect(onToggle).toHaveBeenCalledWith('compression')
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('disables only the row a toggle is in flight for', () => {
    render(<RoomEditor members={MEMBERS} toggling="shape" onToggle={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'enabled' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'disabled' }).hasAttribute('disabled')).toBe(false)
  })

  it('is left in one action', () => {
    const onClose = vi.fn()
    render(<RoomEditor members={MEMBERS} toggling={undefined} onToggle={vi.fn()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
