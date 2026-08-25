import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewPieceForm } from '../../../src/client/NewPieceForm.js'

describe('creating a piece', () => {
  afterEach(cleanup)

  it('is a control until the author reaches for it, then a labelled field, and a control again on the keystroke that leaves everything else', () => {
    render(<NewPieceForm submitting={false} error={undefined} onSubmit={vi.fn()} />)

    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'new piece' }))

    expect(screen.getByLabelText('title')).toBe(screen.getByRole('textbox'))

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })

    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'new piece' })).toBeTruthy()
  })

  it('hands the title over and puts the field away', () => {
    const onSubmit = vi.fn()
    render(<NewPieceForm submitting={false} error={undefined} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', { name: 'new piece' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'The flats at low water' } })
    fireEvent.click(screen.getByRole('button', { name: 'create' }))

    expect(onSubmit).toHaveBeenCalledWith('The flats at low water')
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
