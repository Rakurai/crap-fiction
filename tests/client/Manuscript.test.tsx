// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const saveDraft = vi.fn<(id: string, text: string) => Promise<void>>()

vi.mock('../../src/client/piecesClient.js', () => ({ saveDraft: (id: string, text: string) => saveDraft(id, text) }))

const { Manuscript } = await import('../../src/client/Manuscript.js')

/**
 * The source view is how a test types: it is a plain textarea, so changing it
 * moves the manuscript's text the same way the editor does and the autosave
 * controller cannot tell the difference.
 */
function type(text: string) {
  if (screen.queryByLabelText('Manuscript source') === null) {
    fireEvent.click(screen.getByRole('button', { name: 'source' }))
  }
  fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: text } })
}

/** Past the autosave debounce and past the write's own settling, in one step. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
}

function leaveControl(): HTMLButtonElement {
  return screen.getByRole('button', { name: '‹ pieces' })
}

describe('the manuscript while a save is failing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    saveDraft.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('refuses to leave, says what the machine said, and lets go once a write succeeds', async () => {
    saveDraft.mockRejectedValueOnce(new Error('EACCES: permission denied'))
    render(<Manuscript pieceId="the-lighthouse" title="The Lighthouse" mode="flash" draft="First light." onClose={vi.fn()} />)

    expect(leaveControl().disabled).toBe(false)

    type('First light. Then none.')
    await settle()

    expect(screen.getByRole('status').textContent).toContain('Nothing has been discarded — keep writing.')
    expect(screen.getByRole('status').textContent).not.toMatch(/retry/i)
    expect(screen.getByRole('status').textContent).toContain('The Lighthouse')
    expect(screen.getByText(/^NOT SAVED · \d\d:\d\d$/)).toBeTruthy()
    expect(screen.getByText('EACCES: PERMISSION DENIED')).toBeTruthy()
    expect(leaveControl().disabled).toBe(true)
    expect(screen.getByLabelText('Manuscript source').hasAttribute('disabled')).toBe(false) // the manuscript stays editable

    saveDraft.mockResolvedValueOnce(undefined)
    type('First light. Then none. Then light again.')

    await settle()
    expect(screen.queryByRole('status')).toBeNull()
    expect(leaveControl().disabled).toBe(false)
  })

  it('asks nothing about discarding — the refusal is not a question', async () => {
    saveDraft.mockRejectedValue(new Error('disk unhappy'))
    render(<Manuscript pieceId="the-lighthouse" title="The Lighthouse" mode="flash" draft="First light." onClose={vi.fn()} />)

    type('First light. Then none.')
    await settle()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status').textContent).not.toMatch(/discard\?|are you sure|confirm/i)
  })
})
