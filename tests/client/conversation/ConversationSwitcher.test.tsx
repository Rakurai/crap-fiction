import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '../../../src/shared/conversationEntries.js'
import { ConversationSwitcher } from '../../../src/client/ConversationSwitcher.js'

const NOW = 1_700_000_000_000

const CONVERSATIONS: readonly ConversationSummary[] = [
  { id: 'c1', opening: 'does the opening earn its length', lastActivity: NOW },
  { id: 'c2', lastActivity: NOW - 1000 },
]

type Actions = {
  onSelect?: () => void
  onStartNew?: () => void
  onDelete?: () => void
}

function renderSwitcher(
  deletingId: string | undefined,
  actions: Actions & { onClose?: () => void } = {},
  activeId: string | null = null,
) {
  render(
    <ConversationSwitcher
      conversations={CONVERSATIONS}
      activeId={activeId}
      deletingId={deletingId}
      error={undefined}
      clock={() => NOW}
      onSelect={actions.onSelect ?? vi.fn()}
      onStartNew={actions.onStartNew ?? vi.fn()}
      onDelete={actions.onDelete ?? vi.fn()}
      onClose={actions.onClose ?? vi.fn()}
    />,
  )
}

function armFor(opening: string): HTMLElement {
  return screen.getByRole('button', { name: `Delete the conversation ${opening}` })
}

describe('the conversation listing', () => {
  afterEach(cleanup)

  /**
   * One claim over both kinds of row: a conversation is named by the author's own opening
   * words where it has them, and by a fact about the machine — never the room's words —
   * where it holds no author message at all.
   */
  it("names each conversation by the author's own opening words, or by a fact about the machine where there are none", () => {
    renderSwitcher(undefined)

    expect(screen.getByText('does the opening earn its length')).toBeTruthy()
    expect(screen.getByText('ASKED FOR A CONCRETE CHANGE')).toBeTruthy()
  })

  /** The listing is opened from a transcript, so it says which conversation that transcript is. */
  it('holds the conversation presently open as the current one', () => {
    renderSwitcher(undefined, {}, 'c2')

    const rows = screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-current'))
    expect(rows.map((row) => row.getAttribute('aria-current'))).toEqual(['false', 'true'])
  })

  it('reaches each of its actions in one action apiece, selecting a conversation by its own row', () => {
    const onSelect = vi.fn()
    const onStartNew = vi.fn()
    const onClose = vi.fn()
    renderSwitcher(undefined, { onSelect, onStartNew, onClose })

    fireEvent.click(screen.getByText('does the opening earn its length'))
    fireEvent.click(screen.getByRole('button', { name: 'new conversation' }))
    fireEvent.click(screen.getByRole('button', { name: 'close' }))

    expect(onSelect).toHaveBeenCalledWith('c1')
    expect(onStartNew).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * Losing a conversation is the one irreversible act on this surface, so it is asked for on
   * the row it would delete and confirmed on that row — never a single click in the scan path.
   */
  it('deletes no conversation until the row it names is asked and then confirmed, and can be kept instead', () => {
    const onDelete = vi.fn()
    renderSwitcher(undefined, { onDelete })

    expect(screen.queryByRole('button', { name: 'delete' })).toBeNull()

    fireEvent.click(armFor('does the opening earn its length'))
    fireEvent.click(screen.getByRole('button', { name: 'keep' }))
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(armFor('does the opening earn its length'))
    fireEvent.click(screen.getByRole('button', { name: 'delete' }))
    expect(onDelete).toHaveBeenCalledWith('c1')
  })

  it('keeps an armed row armed once the pointer leaves it', () => {
    renderSwitcher(undefined)

    fireEvent.click(armFor('does the opening earn its length'))
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'delete' }).closest('li')!)

    expect(screen.getByRole('button', { name: 'delete' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'keep' })).toBeTruthy()
  })

  it('goes quiet on the row a deletion is in flight for', () => {
    renderSwitcher('c1')

    fireEvent.click(armFor('does the opening earn its length'))
    expect(screen.getByRole('button', { name: 'delete' }).hasAttribute('disabled')).toBe(true)
  })
})
