import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewPieceForm } from '../../../src/client/NewPieceForm.js'
import type { ModeSummary } from '../../../src/shared/modeViews.js'

const FLASH: ModeSummary = { id: 'flash', displayName: 'Flash' }
const EPIC: ModeSummary = { id: 'epic', displayName: 'Epic' }

describe('creating a piece', () => {
  afterEach(cleanup)

  it('is a control until the author reaches for it, then a labelled field, and a control again on the keystroke that leaves everything else', () => {
    render(<NewPieceForm submitting={false} error={undefined} modes={[FLASH]} onSubmit={vi.fn()} />)

    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'new piece' }))

    expect(screen.getByLabelText('title')).toBe(screen.getByRole('textbox'))

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'new piece' })).toBeTruthy()
  })

  it('hands the title and the one loaded mode over, and puts the field away', () => {
    const onSubmit = vi.fn()
    render(<NewPieceForm submitting={false} error={undefined} modes={[FLASH]} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'new piece' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'The flats at low water' } })
    fireEvent.click(screen.getByRole('button', { name: 'create' }))

    expect(onSubmit).toHaveBeenCalledWith('The flats at low water', 'flash')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('offers no mode picker for one loaded mode, and a picker defaulting to the first when several are loaded', () => {
    const onSubmit = vi.fn()
    render(<NewPieceForm submitting={false} error={undefined} modes={[FLASH, EPIC]} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'new piece' }))
    expect((screen.getByLabelText('mode') as HTMLSelectElement).value).toBe('flash')

    fireEvent.change(screen.getByLabelText('mode'), { target: { value: 'epic' } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A long way home' } })
    fireEvent.click(screen.getByRole('button', { name: 'create' }))

    expect(onSubmit).toHaveBeenCalledWith('A long way home', 'epic')
  })
})
