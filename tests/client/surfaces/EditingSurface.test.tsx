import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomAdapters } from '../../../src/client/useConversation.js'
import { EditingSurface } from '../../../src/client/EditingSurface.js'

function roomHolding(): RoomAdapters {
  return {
    subscribeToRoom: () => ({ snapshot: Promise.resolve({ draft: null, storyContext: null, authorContext: null }), unsubscribe: () => {} }),
    createConversation: () => Promise.resolve({ outcome: 'value', value: { id: 'c1' } }),
    fetchConversation: () => Promise.resolve({ outcome: 'value', value: { id: 'c1', entries: [] } }),
    dispatch: () => Promise.resolve({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    abandonOperation: () => Promise.resolve({ outcome: 'value', value: null }),
    applyRecommendation: () => Promise.resolve({ outcome: 'value', value: { outcome: 'noChange', actionId: 'a1' } }),
    confirmApplication: () => Promise.resolve({ outcome: 'value', value: { entryId: 'e1', change: { kind: 'rewrittenWhole' as const } } }),
    retrievePendingApply: () => Promise.resolve({ outcome: 'value', value: { replacement: 'unused' } }),
    saveDocument: () => Promise.resolve({ outcome: 'value', value: null }),
  }
}

const ROSTER = { settled: true, displayName: (id: string) => id, handle: () => undefined }

const BASE_PROPS = {
  pieceId: 'the-lighthouse',
  title: 'The Lighthouse',
  mode: 'flash',
  body: { kind: 'prose', surface: 'draft' } as const,
  initialText: 'First light.',
  initialConversationId: null,
  initialCast: [],
  initialConversations: [],
  storyEditor: { handle: 'editor', displayName: 'Story Editor', description: 'weighs the whole' },
  interviewer: { handle: 'interview', displayName: 'Interviewer', description: 'asks one question', invocation: 'ask me a clarifying question' },
  room: roomHolding(),
  roster: ROSTER,
  runtime: { reachable: true },
  lifecycle: {
    retitling: false,
    retitleError: undefined,
    onRetitle: vi.fn(),
  },
  active: true,
  onSwitchToSurface: vi.fn(),
  leaveBlocked: false,
  onClose: vi.fn(),
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

  it('renders the plain-text body and its reference schema the same way, on its own transports', () => {
    render(
      <EditingSurface
        {...BASE_PROPS}
        body={{ kind: 'plainText', surface: 'storyContext', referenceSchema: 'Sections, each holding entries.' }}
        initialText="Premise: two cups, one left behind."
      />,
    )

    expect((screen.getByLabelText('Story context') as HTMLTextAreaElement).value).toBe('Premise: two cups, one left behind.')
    fireEvent.click(screen.getByText('reference schema'))
    expect(screen.getByText('Sections, each holding entries.')).toBeTruthy()
  })
})
