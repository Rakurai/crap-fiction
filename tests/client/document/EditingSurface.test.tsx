import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomAdapters } from '../../../src/client/useConversation.js'
import { EditingSurface } from '../../../src/client/EditingSurface.js'
import type { PieceAdapters } from '../../../src/client/usePiece.js'
import { conversationOnDisk, onTheDraft, roomAdapters } from '../../support/roomAdapters.js'

function unreached(name: string) {
  return vi.fn(() => {
    throw new Error(`unreached: no scenario here asks the studio to ${name}`)
  })
}

function roomHolding(): RoomAdapters {
  return roomAdapters({
    subscribeToRoom: () => ({ snapshot: onTheDraft(null), unsubscribe: () => {} }),
    createConversation: () => Promise.resolve({ outcome: 'value', value: { id: 'c1' } }),
    fetchConversation: conversationOnDisk('c1', []),
  })
}

const ROSTER = { settled: true, identify: (id: string) => ({ displayName: id, handle: undefined, mark: null, ordinal: null }) }

const BASE_PROPS = {
  pieceId: 'the-lighthouse',
  title: 'The Lighthouse',
  mode: 'flash',
  namesMode: true,
  body: { kind: 'prose', surface: 'draft', location: 'draft.md' } as const,
  initialText: 'First light.',
  initialConversationId: null,
  initialCast: [],
  initialConversations: [],
  storyEditor: { handle: 'editor', displayName: 'Story Editor', description: 'weighs the whole', mark: 'SE' },
  interviewer: { handle: 'interview', displayName: 'Interviewer', description: 'asks one question', invocation: 'ask me a clarifying question' },
  room: roomHolding(),
  pieceAdapters: {
    fetchPiece: unreached('fetchPiece'),
    updatePiece: unreached('updatePiece'),
  } as unknown as PieceAdapters,
  roster: ROSTER,
  runtime: { reachable: true },
  lifecycle: {
    retitling: false,
    retitleError: undefined,
    onRetitle: vi.fn(),
  },
  active: true,
  onSwitchToSurface: vi.fn(),
  onOpenPieces: vi.fn(),
  onOpenModels: vi.fn(),
  onTextChange: vi.fn(),
  onSaveFailedChange: vi.fn(),
  onFlushRegister: vi.fn(),
  documents: { draft: 'First light.', storyContext: '', authorContext: '' },
}

describe('a surface mounted on its own, with no other transport standing in for it', () => {
  afterEach(cleanup)

  it('renders the prose body and dispatches through only the room it was given', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    render(<EditingSurface {...BASE_PROPS} room={{ ...roomHolding(), dispatch }} />)

    fireEvent.change(await screen.findByLabelText('Message the room'), { target: { value: 'what isn’t working' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await waitFor(() => expect(dispatch).toHaveBeenCalled())
  })

  it('keeps the composer text through a trip into and back out of reading view', async () => {
    render(<EditingSurface {...BASE_PROPS} />)

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: 'a draft of a reply' } })

    fireEvent.click(screen.getByRole('button', { name: 'reading' }))
    expect(screen.queryByLabelText('Manuscript source')).toBeNull()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect((screen.getByLabelText('Message the room') as HTMLTextAreaElement).value).toBe('a draft of a reply')
  })

  it('renders the plain-text body and its reference schema the same way, on its own transports', () => {
    render(
      <EditingSurface
        {...BASE_PROPS}
        body={{ kind: 'plainText', surface: 'storyContext', location: 'story-context.yaml', referenceSchema: 'Sections, each holding entries.' }}
        initialText="Premise: two cups, one left behind."
      />,
    )

    expect((screen.getByLabelText('Story context') as HTMLTextAreaElement).value).toBe('Premise: two cups, one left behind.')
    fireEvent.click(screen.getByText('reference schema'))
    expect(screen.getByText('Sections, each holding entries.')).toBeTruthy()
  })
})
