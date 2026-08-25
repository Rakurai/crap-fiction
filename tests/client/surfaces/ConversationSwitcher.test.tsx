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

function renderSwitcher(deletingId: string | undefined, actions: Actions & { onClose?: () => void } = {}) {
  render(
    <ConversationSwitcher
      conversations={CONVERSATIONS}
      activeId={null}
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

  it('reaches each of its actions in one action apiece, selecting a conversation by its own row', () => {
    const onSelect = vi.fn()
    const onStartNew = vi.fn()
    const onClose = vi.fn()
    renderSwitcher(undefined, { onSelect, onStartNew, onClose })

    fireEvent.click(screen.getByText('does the opening earn its length'))
    fireEvent.click(screen.getByRole('button', { name: 'new' }))
    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(onSelect).toHaveBeenCalledWith('c1')
    expect(onStartNew).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('deletes one conversation, disabling only the row a deletion is in flight for', () => {
    const onDelete = vi.fn()
    renderSwitcher('c1', { onDelete })

    const [firstDelete, secondDelete] = screen.getAllByRole('button', { name: 'delete' })
    expect(firstDelete?.hasAttribute('disabled')).toBe(true)
    expect(secondDelete?.hasAttribute('disabled')).toBe(false)

    if (secondDelete !== undefined) fireEvent.click(secondDelete)
    expect(onDelete).toHaveBeenCalledWith('c2')
  })
})
