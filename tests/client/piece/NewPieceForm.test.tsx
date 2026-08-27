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

  it('hands the title and the one loaded mode over, stays open and populated until the result lands, surfaces a failure, and puts the field away only once creation succeeds', () => {
    const onSubmit = vi.fn()
    const { rerender } = render(<NewPieceForm submitting={false} error={undefined} modes={[FLASH]} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'new piece' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'The flats at low water' } })
    fireEvent.click(screen.getByRole('button', { name: 'create' }))

    expect(onSubmit).toHaveBeenCalledWith('The flats at low water', 'flash')
    rerender(<NewPieceForm submitting={true} error={undefined} modes={[FLASH]} onSubmit={onSubmit} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('The flats at low water')

    rerender(<NewPieceForm submitting={false} error="could not create the piece" modes={[FLASH]} onSubmit={onSubmit} />)
    expect(screen.getByRole('alert').textContent).toBe('could not create the piece')
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('The flats at low water')

    fireEvent.click(screen.getByRole('button', { name: 'create' }))
    rerender(<NewPieceForm submitting={true} error={undefined} modes={[FLASH]} onSubmit={onSubmit} />)
    rerender(<NewPieceForm submitting={false} error={undefined} modes={[FLASH]} onSubmit={onSubmit} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('offers no mode picker for one loaded mode, and requires a choice — submitting none — when several are loaded', () => {
    const onSubmit = vi.fn()
    render(<NewPieceForm submitting={false} error={undefined} modes={[FLASH, EPIC]} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'new piece' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A long way home' } })
    fireEvent.click(screen.getByRole('button', { name: 'create' }))

    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('mode'), { target: { value: 'epic' } })
    fireEvent.click(screen.getByRole('button', { name: 'create' }))

    expect(onSubmit).toHaveBeenCalledWith('A long way home', 'epic')
  })
})
