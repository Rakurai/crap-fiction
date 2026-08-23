import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { facts, modeName, wordCount } from '../../../src/client/facts.js'
import { Manuscript } from '../../../src/client/Manuscript.js'
import type { RequestResult } from '../../../src/client/request.js'
import { useAutosave } from '../../../src/client/useAutosave.js'
import { useManuscript } from '../../../src/client/useManuscript.js'

const saveDraft = vi.fn<(id: string, text: string) => Promise<RequestResult<null>>>()

const DEFAULT_PROPS = {
  pieceId: 'the-lighthouse',
  title: 'The Lighthouse',
  mode: 'flash',
  draft: 'First light of the day.',
  onClose: vi.fn(),
}

/**
 * The prose surface receives its manuscript and its autosave rather than owning
 * them — `OpenedPiece` is where both are constructed, because the conversation
 * beside it needs the same two. This is that composition, minus the conversation:
 * these tests are about the prose surface, and the room is exercised at its own
 * seams (roundProjection, Room).
 */
function Harness(props: typeof DEFAULT_PROPS) {
  const manuscript = useManuscript(props.draft)
  const autosave = useAutosave(props.pieceId, manuscript.markdown, (text) => saveDraft(props.pieceId, text))

  return <Manuscript title={props.title} mode={props.mode} onClose={props.onClose} manuscript={manuscript} autosave={autosave} />
}

/** Every test renders the manuscript through here, overriding only what it cares about. */
function renderManuscript(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<Harness {...DEFAULT_PROPS} {...overrides} />)
}

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

describe('the piece header', () => {
  afterEach(cleanup)

  /**
   * The register's wording is `facts.ts`'s own and is asserted there. What the
   * header claims is narrower: that the mode and the length reach the chrome as
   * one composed fact rather than as two strings the surface joined itself. So the
   * expectation is composed the way the header composes it — a change to the
   * separator or to the pluralisation is a change to one module, and this test is
   * not a second place it has to be made.
   */
  it('states the mode and the length as one composed fact', () => {
    renderManuscript({ draft: 'First light of the day.' })

    expect(screen.getByText(facts(modeName('flash'), wordCount(5)))).toBeTruthy()
  })
})

describe('the reading view', () => {
  afterEach(cleanup)

  it('holds no control at all, and says so in the register rather than in a footer', () => {
    renderManuscript({ draft: 'First light.' })

    fireEvent.click(screen.getByRole('button', { name: 'reading' }))

    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.getByText('ESC TO RETURN')).toBeTruthy()
  })

  it('is left by the keystroke the hint names', () => {
    renderManuscript({ draft: 'First light.' })

    fireEvent.click(screen.getByRole('button', { name: 'reading' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByText('ESC TO RETURN')).toBeNull()
    expect(screen.getByRole('button', { name: '‹ pieces' })).toBeTruthy()
  })
})

describe('the manuscript while a save is failing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    saveDraft.mockReset()
    saveDraft.mockResolvedValue({ outcome: 'value', value: null })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('refuses to leave, says what the machine said, and lets go once a write succeeds', async () => {
    saveDraft.mockResolvedValueOnce({ outcome: 'refused', code: 'ARTIFACT_INVALID', message: 'EACCES: permission denied' })
    renderManuscript({ draft: 'First light.' })

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

    type('First light. Then none. Then light again.')

    await settle()
    expect(screen.queryByRole('status')).toBeNull()
    expect(leaveControl().disabled).toBe(false)
  })

  it('asks nothing about discarding — the refusal is not a question', async () => {
    saveDraft.mockResolvedValue({ outcome: 'refused', code: 'ARTIFACT_INVALID', message: 'disk unhappy' })
    renderManuscript({ draft: 'First light.' })

    type('First light. Then none.')
    await settle()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status').textContent).not.toMatch(/discard\?|are you sure|confirm/i)
  })
})
