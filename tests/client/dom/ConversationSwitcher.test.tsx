import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '../../../src/shared/conversationEntries.js'
import { ConversationSwitcher } from '../../../src/client/ConversationSwitcher.js'

const NOW = 1_700_000_000_000

const CONVERSATIONS: readonly ConversationSummary[] = [
  { id: 'c1', opening: 'does the opening earn its length', lastActivity: NOW },
  { id: 'c2', lastActivity: NOW - 1000 },
]

describe('the conversation listing', () => {
  afterEach(cleanup)

  it('shows each conversation by the author\'s own opening words, and when it was last active', () => {
    render(
      <ConversationSwitcher
        conversations={CONVERSATIONS}
        activeId={null}
        deletingId={undefined}
        error={undefined}
        clock={() => NOW}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('does the opening earn its length')).toBeTruthy()
  })

  it('shows a fact about the machine, never the room\'s words, where a conversation holds no author message at all', () => {
    render(
      <ConversationSwitcher
        conversations={CONVERSATIONS}
        activeId={null}
        deletingId={undefined}
        error={undefined}
        clock={() => NOW}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('ASKED FOR A CONCRETE CHANGE')).toBeTruthy()
  })

  it('starts a new conversation in one action', () => {
    const onStartNew = vi.fn()
    render(
      <ConversationSwitcher
        conversations={CONVERSATIONS}
        activeId={null}
        deletingId={undefined}
        error={undefined}
        clock={() => NOW}
        onSelect={vi.fn()}
        onStartNew={onStartNew}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'new' }))

    expect(onStartNew).toHaveBeenCalledTimes(1)
  })

  it('selects a conversation by its own row', () => {
    const onSelect = vi.fn()
    render(
      <ConversationSwitcher
        conversations={CONVERSATIONS}
        activeId={null}
        deletingId={undefined}
        error={undefined}
        clock={() => NOW}
        onSelect={onSelect}
        onStartNew={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('does the opening earn its length'))

    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('deletes one conversation, disabling only the row a deletion is in flight for', () => {
    const onDelete = vi.fn()
    render(
      <ConversationSwitcher
        conversations={CONVERSATIONS}
        activeId={null}
        deletingId="c1"
        error={undefined}
        clock={() => NOW}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    )

    const [firstDelete, secondDelete] = screen.getAllByRole('button', { name: 'delete' })
    expect(firstDelete?.hasAttribute('disabled')).toBe(true)
    expect(secondDelete?.hasAttribute('disabled')).toBe(false)

    if (secondDelete !== undefined) fireEvent.click(secondDelete)
    expect(onDelete).toHaveBeenCalledWith('c2')
  })

  it('is left in one action', () => {
    const onClose = vi.fn()
    render(
      <ConversationSwitcher
        conversations={CONVERSATIONS}
        activeId={null}
        deletingId={undefined}
        error={undefined}
        clock={() => NOW}
        onSelect={vi.fn()}
        onStartNew={vi.fn()}
        onDelete={vi.fn()}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'done' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
