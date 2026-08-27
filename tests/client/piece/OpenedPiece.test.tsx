import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomAdapters } from '../../../src/client/useConversation.js'
import type { PieceDetail } from '../../../src/shared/pieceViews.js'
import { OpenedPiece, type CallSiteAdapters, type PieceSwitchRequest } from '../../../src/client/OpenedPiece.js'
import type { PieceAdapters } from '../../../src/client/usePiece.js'
import { onTheDraft, roomAdapters, roomStream } from '../../support/roomAdapters.js'

const PIECE: PieceDetail = {
  id: 'cups',
  title: 'The Cups',
  mode: 'flash',
  length: 5,
  modified: 1_700_000_000_000,
  surfaces: {
    draft: {
      location: 'draft.md',
      text: 'First light of the day.',
      referenceSchema: null,
      currentConversationId: 'd1',
      conversations: [
        { id: 'd1', opening: 'what isn’t working', lastActivity: 2 },
        { id: 'd2', opening: 'try a different opening', lastActivity: 1 },
      ],
      cast: [],
    },
    storyContext: {
      location: 'story-context.yaml',
      text: 'Premise: two cups, one left behind.',
      referenceSchema: 'Sections, each holding entries.',
      currentConversationId: null,
      conversations: [],
      cast: [],
    },
    authorContext: {
      location: 'config/author-context.yaml',
      text: '',
      referenceSchema: 'What this test calls the author-context reference; the studio\'s own wording is the server\'s.',
      currentConversationId: null,
      conversations: [],
      cast: [],
    },
  },
  storyEditor: { handle: 'editor', displayName: 'Story Editor', description: 'weighs the whole', mark: 'SE' },
  interviewer: { handle: 'interview', displayName: 'Interviewer', description: 'asks one question', invocation: 'ask me a clarifying question' },
}

function conversationEntries(conversationId: string) {
  return [{ id: `${conversationId}-e1`, kind: 'authorMessage' as const, text: `opened as ${conversationId}`, audience: [], brought: [] }]
}

const SAVED: RequestResult<null> = { outcome: 'value', value: null }
const NO_SWITCH_REQUEST: PieceSwitchRequest = { targetId: undefined, onSettled: () => {} }

function studio(room: Partial<RoomAdapters> = {}) {
  const stream = roomStream(onTheDraft(null))
  const saveDocument = vi.fn(() => Promise.resolve(SAVED))
  const dispatched = vi.fn(() => Promise.resolve({ outcome: 'value' as const, value: { conversationId: 'd1', actionId: 'a1' } }))
  const abandonOperation = vi.fn(() => Promise.resolve(SAVED))

  return {
    stream: stream.stream,
    saveDocument,
    dispatch: dispatched,
    abandonOperation,
    props: {
      pieceAdapters: {
        fetchPiece: vi.fn(() => Promise.resolve({ outcome: 'value' as const, value: PIECE })),
        updatePiece: vi.fn(() => {
          throw new Error('unreached: this scenario never retitles the piece or changes its status')
        }),
      } as unknown as PieceAdapters,
      callSites: {
        fetchCallSites: vi.fn(() => Promise.resolve({ outcome: 'value' as const, value: [] })),
        fetchRuntimeStatus: vi.fn(() => Promise.resolve({ outcome: 'value' as const, value: { reachable: true, models: [] } })),
      } as unknown as CallSiteAdapters,
      room: roomAdapters({
        subscribeToRoom: stream.subscribeToRoom,
        createConversation: vi.fn(() => Promise.resolve({ outcome: 'value' as const, value: { id: 'new-conversation' } })),
        fetchConversation: vi.fn((_pieceId: string, _surface: string, conversationId: string) =>
          Promise.resolve({ outcome: 'value' as const, value: { id: conversationId, entries: conversationEntries(conversationId) } }),
        ) as unknown as RoomAdapters['fetchConversation'],
        dispatch: dispatched as unknown as RoomAdapters['dispatch'],
        abandonOperation: abandonOperation as unknown as RoomAdapters['abandonOperation'],
        saveDocument: saveDocument as unknown as RoomAdapters['saveDocument'],
        ...room,
      }),
    },
  }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function fullProps(
  opened: ReturnType<typeof studio>,
  overrides: Partial<{
    onOpenPieces: () => void
    onOpenModels: () => void
    onLeaveBlockedChange: (blocked: boolean) => void
    switchRequest: PieceSwitchRequest
  }> = {},
) {
  return {
    ...opened.props,
    onOpenPieces: vi.fn(),
    onOpenModels: vi.fn(),
    onLeaveBlockedChange: vi.fn(),
    switchRequest: NO_SWITCH_REQUEST,
    ...overrides,
  }
}

async function renderOpened(opened: ReturnType<typeof studio>, overrides: Parameters<typeof fullProps>[1] = {}) {
  const props = fullProps(opened, overrides)
  const view = render(<OpenedPiece id="cups" {...props} />)
  await screen.findByRole('button', { name: 'The Cups' })
  return { ...view, props }
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
}

function switchToStoryContext(): void {
  fireEvent.click(screen.getByRole('button', { name: 'story' }))
}

function switchToDraft(): void {
  fireEvent.click(screen.getByRole('button', { name: 'draft' }))
}

function switchToAuthorContext(): void {
  fireEvent.click(screen.getByRole('button', { name: 'author' }))
}

function activeComposer(): HTMLTextAreaElement {
  const send = screen.getByRole('button', { name: 'send' })
  const form = send.closest('form')
  if (form === null) throw new Error('the send button is not inside a composer form')
  return within(form).getByLabelText('Message the room') as HTMLTextAreaElement
}

describe('switching between the draft and story context surfaces', () => {
  it("preserves each surface's own text, conversation selection and composer state across a switch away and back", async () => {
    await renderOpened(studio())

    fireEvent.click(screen.getByRole('button', { name: 'conversations' }))
    fireEvent.click(await screen.findByRole('button', { name: /^try a different opening/ }))
    await screen.findByText('opened as d2', { selector: 'p' })

    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: 'First light of the day. Then dusk.' } })
    fireEvent.change(activeComposer(), { target: { value: 'what do you make of the new line' } })

    switchToStoryContext()
    await screen.findByLabelText('Story context')
    expect(activeComposer().value).toBe('')

    switchToDraft()

    expect((screen.getByLabelText('Manuscript source') as HTMLTextAreaElement).value).toBe('First light of the day. Then dusk.')
    expect(activeComposer().value).toBe('what do you make of the new line')
    await screen.findByText('opened as d2', { selector: 'p' })

    fireEvent.click(screen.getByRole('button', { name: 'conversations' }))
    expect((await screen.findByRole('button', { name: /^try a different opening/ })).getAttribute('aria-current')).toBe('true')
  })
})

describe('a failed save on one document', () => {
  it('leaves the other document’s state untouched, and reports the piece as blocking a switch to another', async () => {
    const failingDraft = vi.fn((_id: string, surface: string, _text: string) =>
      surface === 'draft'
        ? Promise.resolve<RequestResult<null>>({ outcome: 'refused', code: 'ARTIFACT_INVALID', message: 'EACCES: permission denied' })
        : Promise.resolve(SAVED),
    )
    const onLeaveBlockedChange = vi.fn()
    await renderOpened(studio({ saveDocument: failingDraft as unknown as RoomAdapters['saveDocument'] }), { onLeaveBlockedChange })
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: 'First light of the day. Then none.' } })
    await settle()

    expect(screen.getByText('EACCES: PERMISSION DENIED')).toBeTruthy()
    expect(onLeaveBlockedChange).toHaveBeenLastCalledWith(true)

    switchToStoryContext()
    fireEvent.change(screen.getByLabelText('Story context'), { target: { value: 'Premise: two cups, one chipped.' } })
    await settle()

    expect(screen.getAllByText('EACCES: PERMISSION DENIED')).toHaveLength(1)
    expect((screen.getByLabelText('Story context') as HTMLTextAreaElement).value).toBe('Premise: two cups, one chipped.')
    expect(onLeaveBlockedChange).toHaveBeenLastCalledWith(true)

    switchToDraft()
    failingDraft.mockImplementation(() => Promise.resolve(SAVED))
    fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: 'First light of the day. Then light again.' } })
    await settle()

    expect(onLeaveBlockedChange).toHaveBeenLastCalledWith(false)
  })
})

describe('switching to another piece', () => {
  it('waits on a dirty surface, and reports the switch blocked with the failure visible when that write fails', async () => {
    let resolveSave: ((result: RequestResult<null>) => void) | undefined
    const heldSave = vi.fn(
      () =>
        new Promise<RequestResult<null>>((resolve) => {
          resolveSave = resolve
        }),
    )
    const onSettled = vi.fn()
    const { rerender, props } = await renderOpened(studio({ saveDocument: heldSave as unknown as RoomAdapters['saveDocument'] }))
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: 'First light of the day. Then none.' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    rerender(<OpenedPiece id="cups" {...props} switchRequest={{ targetId: 'saucers', onSettled }} />)
    expect(onSettled).not.toHaveBeenCalled()

    await act(async () => {
      resolveSave?.({ outcome: 'refused', code: 'ARTIFACT_INVALID', message: 'EACCES: permission denied' })
    })

    expect(onSettled).toHaveBeenCalledWith(true)
    expect(screen.getByText('EACCES: PERMISSION DENIED')).toBeTruthy()
  })

  it('settles a switch while a surface still has work in flight, without asking the studio to end it', async () => {
    const opened = studio()
    const onSettled = vi.fn()
    const { rerender, props } = await renderOpened(opened)

    fireEvent.change(activeComposer(), { target: { value: 'what isn’t working' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))
    await waitFor(() => expect(opened.dispatch).toHaveBeenCalled())

    opened.stream({
      type: 'action.started',
      data: { actionId: 'a1', conversationId: 'd1', kind: 'dispatch', sourceEntryId: 'e0', startedAt: 1_700_000_000_000, audience: [], surface: 'draft' },
    })

    rerender(<OpenedPiece id="cups" {...props} switchRequest={{ targetId: 'saucers', onSettled }} />)

    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(false))
    expect(opened.abandonOperation).not.toHaveBeenCalled()
  })
})

describe('activity on one surface', () => {
  it('leaves the other two free to start their own work', async () => {
    await renderOpened(studio())

    fireEvent.change(activeComposer(), { target: { value: 'a message for the draft room' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))
    expect((screen.getByRole('button', { name: 'send' }) as HTMLButtonElement).disabled).toBe(true)

    switchToStoryContext()
    fireEvent.change(activeComposer(), { target: { value: 'a message for the story context room' } })
    expect((screen.getByRole('button', { name: 'send' }) as HTMLButtonElement).disabled).toBe(false)

    switchToAuthorContext()
    fireEvent.change(activeComposer(), { target: { value: 'a message for the author context room' } })
    expect((screen.getByRole('button', { name: 'send' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('the author-context conversation selection', () => {
  it("is read from the caller rather than the piece it opens with, and a fresh choice is reported back to the caller — so a switch away and back to a different piece never loses it", async () => {
    const onAuthorContextSelectionChange = vi.fn()
    const opened = studio()
    render(
      <OpenedPiece
        id="cups"
        {...fullProps(opened)}
        authorContextSelection={{ value: 'kept-across-a-piece-switch', onChange: onAuthorContextSelectionChange }}
      />,
    )
    await screen.findByRole('button', { name: 'The Cups' })

    fireEvent.click(screen.getByRole('button', { name: 'author' }))
    await screen.findByText('opened as kept-across-a-piece-switch', { selector: 'p' })

    fireEvent.click(screen.getByRole('button', { name: 'conversations' }))
    fireEvent.click(screen.getByRole('button', { name: 'new conversation' }))

    expect(onAuthorContextSelectionChange).toHaveBeenCalledWith(null)
  })
})
