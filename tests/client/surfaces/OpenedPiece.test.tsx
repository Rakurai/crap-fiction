import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomActivitySnapshot } from '../../../src/shared/conversationEvents.js'
import type { PieceDetail } from '../../../src/shared/pieceViews.js'
import { OpenedPiece } from '../../../src/client/OpenedPiece.js'

const mocks = vi.hoisted(() => ({
  fetchPiece: vi.fn(),
  updatePiece: vi.fn(),
  saveSurfaceDocument: vi.fn(),
  createConversation: vi.fn(),
  fetchConversation: vi.fn(),
  dispatch: vi.fn(),
  subscribeToRoom: vi.fn(),
  abandonOperation: vi.fn(),
  applyRecommendation: vi.fn(),
  confirmApplication: vi.fn(),
  fetchCallSites: vi.fn(),
  fetchRuntimeStatus: vi.fn(),
}))

vi.mock('../../../src/client/piecesClient.js', () => ({
  fetchPiece: mocks.fetchPiece,
  updatePiece: mocks.updatePiece,
  saveSurfaceDocument: mocks.saveSurfaceDocument,
}))

vi.mock('../../../src/client/roomClient.js', () => ({
  createConversation: mocks.createConversation,
  fetchConversation: mocks.fetchConversation,
  dispatch: mocks.dispatch,
  subscribeToRoom: mocks.subscribeToRoom,
  abandonOperation: mocks.abandonOperation,
  applyRecommendation: mocks.applyRecommendation,
  confirmApplication: mocks.confirmApplication,
  EMPTY_ROOM_ACTIVITY: { draft: null, storyContext: null, authorContext: null },
}))

vi.mock('../../../src/client/callSitesClient.js', () => ({
  fetchCallSites: mocks.fetchCallSites,
  fetchRuntimeStatus: mocks.fetchRuntimeStatus,
}))

const EMPTY_ACTIVITY: RoomActivitySnapshot = { draft: null, storyContext: null, authorContext: null }

const PIECE: PieceDetail = {
  id: 'cups',
  title: 'The Cups',
  mode: 'flash',
  status: 'drafting',
  length: 5,
  modified: 1_700_000_000_000,
  surfaces: {
    draft: {
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
      text: 'Premise: two cups, one left behind.',
      referenceSchema: 'Sections, each holding entries.',
      currentConversationId: null,
      conversations: [],
      cast: [],
    },
    authorContext: {
      text: '',
      referenceSchema: 'Notes about the author that generalize beyond any single piece.',
      currentConversationId: null,
      conversations: [],
      cast: [],
    },
  },
  storyEditor: { handle: 'editor', displayName: 'Story Editor', description: 'weighs the whole' },
}

function conversationEntries(conversationId: string) {
  return [{ id: `${conversationId}-e1`, kind: 'authorMessage' as const, text: `opened as ${conversationId}`, audience: [], brought: [] }]
}

beforeEach(() => {
  mocks.fetchPiece.mockResolvedValue({ outcome: 'value', value: PIECE })
  mocks.updatePiece.mockResolvedValue({ outcome: 'value', value: PIECE })
  mocks.saveSurfaceDocument.mockResolvedValue({ outcome: 'value', value: null })
  mocks.createConversation.mockResolvedValue({ outcome: 'value', value: { id: 'new-conversation' } })
  mocks.fetchConversation.mockImplementation((_pieceId: string, _surface: string, conversationId: string) =>
    Promise.resolve({ outcome: 'value', value: { id: conversationId, entries: conversationEntries(conversationId) } }),
  )
  mocks.dispatch.mockResolvedValue({ outcome: 'value', value: { conversationId: 'd1', actionId: 'a1' } })
  mocks.abandonOperation.mockResolvedValue({ outcome: 'value', value: null })
  mocks.applyRecommendation.mockResolvedValue({ outcome: 'value', value: { outcome: 'noChange', actionId: 'a1' } })
  mocks.confirmApplication.mockResolvedValue({ outcome: 'value', value: { entryId: 'e1', change: { kind: 'rewrittenWhole' } } })
  mocks.subscribeToRoom.mockImplementation(() => ({ snapshot: Promise.resolve(EMPTY_ACTIVITY), unsubscribe: () => {} }))
  mocks.fetchCallSites.mockResolvedValue({ outcome: 'value', value: [] })
  mocks.fetchRuntimeStatus.mockResolvedValue({ outcome: 'value', value: { reachable: true, models: [] } })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

async function renderOpened() {
  render(<OpenedPiece id="cups" onClose={() => {}} />)
  await screen.findByRole('button', { name: 'The Cups' })
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
}

function switchToStoryContext(): void {
  fireEvent.click(screen.getByRole('button', { name: 'story context' }))
}

function switchToDraft(): void {
  fireEvent.click(screen.getByRole('button', { name: 'draft' }))
}

/** The composer belonging to whichever surface is currently visible — role queries alone exclude the hidden one. */
function activeComposer(): HTMLTextAreaElement {
  const send = screen.getByRole('button', { name: 'send' })
  const form = send.closest('form')
  if (form === null) throw new Error('the send button is not inside a composer form')
  return within(form).getByLabelText('Message the room') as HTMLTextAreaElement
}

describe('switching between the draft and story context surfaces', () => {
  it("preserves each surface's own text, conversation selection and composer state across a switch away and back", async () => {
    await renderOpened()

    // Select the conversation the piece did not open with, then compose against it, without
    // sending: switching conversations is its own fresh session, but switching surfaces is not.
    fireEvent.click(screen.getByRole('button', { name: 'conversations' }))
    fireEvent.click(await screen.findByRole('button', { name: /^try a different opening/ }))
    await screen.findByText('opened as d2')

    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: 'First light of the day. Then dusk.' } })
    fireEvent.change(activeComposer(), { target: { value: 'what do you make of the new line' } })

    switchToStoryContext()
    await screen.findByLabelText('Story context')
    // A fresh surface is showing: nothing of draft's composer state leaked into it.
    expect(activeComposer().value).toBe('')

    switchToDraft()

    expect((screen.getByLabelText('Manuscript source') as HTMLTextAreaElement).value).toBe('First light of the day. Then dusk.')
    expect(activeComposer().value).toBe('what do you make of the new line')
    await screen.findByText('opened as d2')

    fireEvent.click(screen.getByRole('button', { name: 'conversations' }))
    expect((await screen.findByRole('button', { name: /^try a different opening/ })).getAttribute('aria-current')).toBe('true')
  })
})

describe('a failed save on one document', () => {
  it("leaves the other document's state untouched, and blocks leaving until the failure resolves", async () => {
    mocks.saveSurfaceDocument.mockImplementation((_id: string, surface: string, _text: string) =>
      surface === 'draft'
        ? Promise.resolve({ outcome: 'refused', code: 'ARTIFACT_INVALID', message: 'EACCES: permission denied' })
        : Promise.resolve({ outcome: 'value', value: null }),
    )
    await renderOpened()
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'source' }))
    fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: 'First light of the day. Then none.' } })
    await settle()

    expect(screen.getByText('EACCES: PERMISSION DENIED')).toBeTruthy()
    expect(screen.getByRole('button', { name: '‹ pieces' }).hasAttribute('disabled')).toBe(true)

    switchToStoryContext()
    fireEvent.change(screen.getByLabelText('Story context'), { target: { value: 'Premise: two cups, one chipped.' } })
    await settle()

    // Story context's own write succeeded, so only draft's document carries a failure notice.
    expect(screen.getAllByText('EACCES: PERMISSION DENIED')).toHaveLength(1)
    expect((screen.getByLabelText('Story context') as HTMLTextAreaElement).value).toBe('Premise: two cups, one chipped.')
    // Draft's failure still blocks leaving, from whichever surface is showing.
    expect(screen.getByRole('button', { name: '‹ pieces' }).hasAttribute('disabled')).toBe(true)

    switchToDraft()
    mocks.saveSurfaceDocument.mockResolvedValue({ outcome: 'value', value: null })
    fireEvent.change(screen.getByLabelText('Manuscript source'), { target: { value: 'First light of the day. Then light again.' } })
    await settle()

    expect(screen.getByRole('button', { name: '‹ pieces' }).hasAttribute('disabled')).toBe(false)
  })
})

describe('activity on one surface', () => {
  it('leaves the other free to start its own work', async () => {
    await renderOpened()

    fireEvent.change(activeComposer(), { target: { value: 'a message for the draft room' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))
    expect((screen.getByRole('button', { name: 'send' }) as HTMLButtonElement).disabled).toBe(true)

    switchToStoryContext()
    fireEvent.change(activeComposer(), { target: { value: 'a message for the story context room' } })

    expect((screen.getByRole('button', { name: 'send' }) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('the author-context conversation selection', () => {
  it("is read from the caller rather than the piece it opens with, and a fresh choice is reported back to the caller — so a switch away and back to a different piece never loses it", async () => {
    const onAuthorContextSelectionChange = vi.fn()
    render(
      <OpenedPiece
        id="cups"
        authorContextSelection={{ value: 'kept-across-a-piece-switch', onChange: onAuthorContextSelectionChange }}
        onClose={() => {}}
      />,
    )
    await screen.findByRole('button', { name: 'The Cups' })

    fireEvent.click(screen.getByRole('button', { name: 'author context' }))
    await screen.findByText('opened as kept-across-a-piece-switch')

    fireEvent.click(screen.getByRole('button', { name: 'conversations' }))
    fireEvent.click(screen.getByRole('button', { name: 'new' }))

    expect(onAuthorContextSelectionChange).toHaveBeenCalledWith(null)
  })
})
