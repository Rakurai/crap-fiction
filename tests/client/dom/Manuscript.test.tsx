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
  onOpenRoom: vi.fn(),
  onOpenConversations: vi.fn(),
  onOpenCapture: vi.fn(),
  lifecycle: {
    status: 'drafting' as const,
    retitling: false,
    retitleError: undefined as string | undefined,
    onRetitle: vi.fn(),
    settingStatus: false,
    statusError: undefined as string | undefined,
    onSetStatus: vi.fn(),
  },
  applying: undefined as { readonly participantName: string } | undefined,
}

function Harness(props: typeof DEFAULT_PROPS) {
  const manuscript = useManuscript(props.draft)
  const autosave = useAutosave(props.pieceId, manuscript.markdown, (text) => saveDraft(props.pieceId, text))

  return (
    <Manuscript
      title={props.title}
      mode={props.mode}
      onClose={props.onClose}
      manuscript={manuscript}
      autosave={autosave}
      onOpenRoom={props.onOpenRoom}
      onOpenConversations={props.onOpenConversations}
      onOpenCapture={props.onOpenCapture}
      lifecycle={props.lifecycle}
      applying={props.applying}
    />
  )
}

function renderManuscript(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<Harness {...DEFAULT_PROPS} {...overrides} />)
}

function type(text: string) {
  if (screen.queryByLabelText('Manuscript source') === null) {
    fireEvent.click(screen.getByRole('button', { name: 'source' }))
  }
  fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: text } })
}

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

  it('states the mode and the length as one composed fact', () => {
    renderManuscript({ draft: 'First light of the day.' })

    expect(screen.getByText(facts(modeName('flash'), wordCount(5)))).toBeTruthy()
  })
})

describe('the piece title', () => {
  afterEach(cleanup)

  it('is reached and left in one action each way, and retitles on submit', () => {
    const onRetitle = vi.fn()
    renderManuscript({ lifecycle: { ...DEFAULT_PROPS.lifecycle, onRetitle } })

    fireEvent.click(screen.getByRole('button', { name: 'The Lighthouse' }))
    const input = screen.getByLabelText('Piece title')
    fireEvent.change(input, { target: { value: 'The Lantern' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(onRetitle).toHaveBeenCalledWith('The Lantern')
    expect(screen.queryByLabelText('Piece title')).toBeNull()
    expect(screen.getByRole('button', { name: 'The Lighthouse' })).toBeTruthy()
  })

  it('withdraws on Escape without retitling', () => {
    const onRetitle = vi.fn()
    renderManuscript({ lifecycle: { ...DEFAULT_PROPS.lifecycle, onRetitle } })

    fireEvent.click(screen.getByRole('button', { name: 'The Lighthouse' }))
    fireEvent.change(screen.getByLabelText('Piece title'), { target: { value: 'Something else entirely' } })
    fireEvent.keyDown(screen.getByLabelText('Piece title'), { key: 'Escape' })

    expect(onRetitle).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'The Lighthouse' })).toBeTruthy()
  })

  it('asks nothing of an unchanged or blank title', () => {
    const onRetitle = vi.fn()
    renderManuscript({ lifecycle: { ...DEFAULT_PROPS.lifecycle, onRetitle } })

    fireEvent.click(screen.getByRole('button', { name: 'The Lighthouse' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(onRetitle).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'The Lighthouse' }))
    fireEvent.change(screen.getByLabelText('Piece title'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(onRetitle).not.toHaveBeenCalled()
  })
})

describe('the piece status', () => {
  afterEach(cleanup)

  it('is marked finished or abandoned with nothing more asked', () => {
    const onSetStatus = vi.fn()
    renderManuscript({ lifecycle: { ...DEFAULT_PROPS.lifecycle, onSetStatus } })

    fireEvent.change(screen.getByLabelText('Piece status'), { target: { value: 'finished' } })

    expect(onSetStatus).toHaveBeenCalledWith('finished')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('states a refused status change beside the header rather than silently', () => {
    renderManuscript({ lifecycle: { ...DEFAULT_PROPS.lifecycle, statusError: 'the studio did not answer' } })

    expect(screen.getByRole('alert').textContent).toBe('the studio did not answer')
  })
})

describe('editing the room', () => {
  afterEach(cleanup)

  it('is one action away, and knows nothing beyond that it was reached', () => {
    const onOpenRoom = vi.fn()
    renderManuscript({ onOpenRoom })

    fireEvent.click(screen.getByRole('button', { name: 'room' }))

    expect(onOpenRoom).toHaveBeenCalledTimes(1)
  })
})

describe('capture context', () => {
  afterEach(cleanup)

  it('is one action away, and knows nothing beyond that it was reached', () => {
    const onOpenCapture = vi.fn()
    renderManuscript({ onOpenCapture })

    fireEvent.click(screen.getByRole('button', { name: 'capture context' }))

    expect(onOpenCapture).toHaveBeenCalledTimes(1)
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

describe('the manuscript while an application is in flight', () => {
  afterEach(cleanup)

  it('holds the source textarea read-only, and names the response holding it, while an application runs', () => {
    renderManuscript({ applying: { participantName: 'Compression' } })

    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    expect(screen.getByLabelText('Manuscript source').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('READ-ONLY')).toBeTruthy()
    expect(screen.getByText("Held while Compression's change is applied.")).toBeTruthy()
  })

  it('is editable again, with no trace of the notice, the instant the application is no longer applying', () => {
    const { rerender } = renderManuscript({ applying: { participantName: 'Compression' } })
    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    expect(screen.getByLabelText('Manuscript source').hasAttribute('disabled')).toBe(true)

    rerender(<Harness {...DEFAULT_PROPS} applying={undefined} />)

    expect(screen.getByLabelText('Manuscript source').hasAttribute('disabled')).toBe(false)
    expect(screen.queryByText('READ-ONLY')).toBeNull()
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
    expect(screen.getByLabelText('Manuscript source').hasAttribute('disabled')).toBe(false)

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
