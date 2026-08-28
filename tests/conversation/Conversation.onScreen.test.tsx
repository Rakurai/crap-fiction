import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApplicationEntryView, ConversationEntryView } from '../../src/shared/conversationEntryViews.js'
import type { ConversationActivitySnapshot, RoomEvent } from '../../src/shared/conversationEvents.js'
import { Conversation } from '../../src/client/Conversation.js'
import type { RequestResult } from '../../src/client/request.js'
import type { ApplyConfirmation } from '../../src/shared/applyViews.js'
import type { RoomAdapters } from '../../src/client/useConversation.js'
import { conversationOnDisk, onTheDraft, roomAdapters, roomStream } from '../support/roomAdapters.js'

const DOCUMENTS = { draft: 'First light.', storyContext: '', authorContext: '' }

const NAMES: Record<string, string> = { shape: 'Shape', reader: 'Reader Experience', editor: 'Story Editor' }

const HANDLES = [
  { handle: 'shape', displayName: 'Shape' },
  { handle: 'reader', displayName: 'Reader Experience' },
  { handle: 'editor', displayName: 'Story Editor' },
]

const INTERVIEWER = { handle: 'interview', displayName: 'Interviewer', description: 'asks one question', invocation: 'ask me a clarifying question' }

const HANDLE_BY_ID: Record<string, string> = { shape: 'shape', reader: 'reader', editor: 'editor' }

const RESPONSE_WITH_COMMENTARY: ConversationEntryView = {
  id: 'e0',
  kind: 'participantResponse',
  participantId: 'shape',
  causeId: 'e-1',
  outcome: 'commentary',
  claim: 'It holds.',
}

function roomHolding(entries: readonly ConversationEntryView[]): RoomAdapters {
  return roomAdapters({
    subscribeToRoom: () => ({ snapshot: onTheDraft(null), unsubscribe: () => {} }),
    createConversation: () => Promise.resolve({ outcome: 'value', value: { id: 'c1' } }),
    fetchConversation: conversationOnDisk('c1', entries),
    dispatch: () => Promise.resolve({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    applyRecommendation: () => Promise.resolve({ outcome: 'value', value: { outcome: 'noChange', actionId: 'a1' } }),
  })
}

function renderConversation(entries: readonly ConversationEntryView[], extra: Partial<ComponentProps<typeof Conversation>> = {}) {
  return render(
    <Conversation
      pieceId="the-lighthouse"
      surface="draft"
      currentConversationId="c1"
      documents={DOCUMENTS}
      flushDocument={() => Promise.resolve({ failed: false })}
      room={roomHolding(entries)}
      identify={(id) => ({ displayName: NAMES[id] ?? id, handle: HANDLE_BY_ID[id], mark: null, ordinal: null })}
      handles={HANDLES}
      interviewer={INTERVIEWER}
      runtime={{ reachable: true }}
      clock={() => 1_700_000_000_000}
      onApplied={() => Promise.resolve({ failed: false })}
      onApplyingChange={() => {}}
      onConversationIdChange={() => {}}
      onOpenRoom={() => {}}
      onOpenConversations={() => {}}
      {...extra}
    />,
  )
}

function roomStreaming(entries: readonly ConversationEntryView[]): { room: RoomAdapters; stream: (...events: readonly RoomEvent[]) => void } {
  const { subscribeToRoom, stream } = roomStream(onTheDraft(null))
  return { room: { ...roomHolding(entries), subscribeToRoom }, stream }
}

function blockContaining(text: string): HTMLElement {
  const said = screen.getByText(text)
  const block = said.parentElement
  if (block === null) throw new Error(`"${text}" was drawn with no block around it`)
  return block
}

describe('a landed response in the conversation', () => {
  afterEach(cleanup)

  it('sets the claim, its note and the participant that said it apart — two registers, a name and not an id, never one sentence trailing another', async () => {
    renderConversation([
      { id: 'e1', kind: 'authorMessage', text: 'what isn’t working about the ending', audience: [], brought: [] },
      {
        id: 'e2',
        kind: 'participantResponse',
        participantId: 'reader',
        causeId: 'e1',
        outcome: 'commentary',
        claim: 'The ending arrives before the fear does.',
        note: 'Three paragraphs earlier the light is already gone.',
      },
    ])

    const claim = await screen.findByText('The ending arrives before the fear does.')
    const note = screen.getByText('Three paragraphs earlier the light is already gone.')

    expect(claim.textContent).not.toContain('Three paragraphs')
    expect(claim.contains(note)).toBe(false)
    expect(note.contains(claim)).toBe(false)

    const block = blockContaining('The ending arrives before the fear does.').textContent
    expect(block).toContain('@reader')
    expect(block).toContain('Reader Experience')
  })

  it('states a no-comment outcome as one line under the participant that read, carrying nothing to act on', async () => {
    renderConversation([
      { id: 'e1', kind: 'participantNoComment', participantId: 'shape', causeId: 'e0' },
      { id: 'e2', kind: 'participantResponse', participantId: 'editor', causeId: 'e0', outcome: 'commentary', claim: 'It holds.' },
    ])

    await screen.findByText('It holds.')

    const declined = blockContaining('NOTHING TO ADD')
    expect(declined.textContent).toContain('@shape')
    expect(declined.textContent).toContain('Shape')
    expect(within(declined).queryByRole('button')).toBeNull()
    expect(within(declined).queryByRole('textbox')).toBeNull()
  })

  it("states a failed call in the machine's register under the participant that did not answer, with whatever came back where anything did", async () => {
    renderConversation([
      { id: 'e1', kind: 'participantFailure', participantId: 'shape', causeId: 'e0', reason: 'timeout' },
      { id: 'e2', kind: 'participantFailure', participantId: 'reader', causeId: 'e0', reason: 'nonconforming', returned: '{"claim": "the ending' },
    ])

    await waitFor(() => expect(screen.getByText('did not answer — TIMEOUT')).toBeTruthy())
    expect(blockContaining('did not answer — TIMEOUT').textContent).toContain('Shape')
    expect(screen.getByText('{"claim": "the ending')).toBeTruthy()
  })
})

const LONG_CLAIM = 'The ending arrives before the fear does, and the fear is the only thing the scene was ever about.'

const LONG_NOTE = 'Three paragraphs earlier the light is already gone, which is where the dread should have started to gather.'

function everythingOverflows(): () => void {
  const was = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 200 })
  return () => {
    if (was === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
      return
    }
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', was)
  }
}

describe('a response too long to show whole', () => {
  afterEach(cleanup)

  it('truncates the claim and the note alike, each behind a toggle inside the text it cuts, and offers no toggle where nothing is cut', async () => {
    const restore = everythingOverflows()
    try {
      renderConversation([
        { id: 'e1', kind: 'participantResponse', participantId: 'reader', causeId: 'e0', outcome: 'commentary', claim: LONG_CLAIM, note: LONG_NOTE },
      ])

      const [claimToggle, noteToggle] = await screen.findAllByRole('button', { name: '… MORE' })
      expect(claimToggle?.parentElement?.textContent).toContain(LONG_CLAIM)
      expect(noteToggle?.parentElement?.textContent).toContain(LONG_NOTE)
      expect(screen.getAllByRole('button', { name: '… MORE' })).toHaveLength(2)

      if (claimToggle === undefined) throw new Error('the claim was drawn with nothing to disclose it')
      fireEvent.click(claimToggle)

      const opened = screen.getByRole('button', { name: 'LESS' })
      expect(opened.getAttribute('aria-expanded')).toBe('true')
      expect(opened.parentElement?.textContent).toContain(LONG_CLAIM)

      fireEvent.click(opened)

      expect(screen.getAllByRole('button', { name: '… MORE' })).toHaveLength(2)
    } finally {
      restore()
    }
  })

  it('leaves a claim that fits with no toggle at all', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    await screen.findByText('It holds.')
    expect(screen.queryByRole('button', { name: /MORE/ })).toBeNull()
  })
})

describe('a room that cannot be reached', () => {
  afterEach(cleanup)

  it('says so at the composer with what is still true, and says nothing at all while nothing has been heard either way', async () => {
    renderConversation([], { runtime: { reachable: false } })

    await waitFor(() => expect(screen.getByText('ROOM UNAVAILABLE')).toBeTruthy())
    expect(screen.getByText('No model is reachable. The manuscript is yours to write.')).toBeTruthy()

    cleanup()
    renderConversation([RESPONSE_WITH_COMMENTARY], { runtime: undefined })

    await screen.findByText('It holds.')
    expect(screen.queryByText('ROOM UNAVAILABLE')).toBeNull()
  })
})

describe('a specialist the addressing brought into the room', () => {
  afterEach(cleanup)

  it('says which one, beside the message that brought it in — and says nothing where addressing changed nothing', async () => {
    renderConversation([
      { id: 'e1', kind: 'authorMessage', text: '@reader is this scene too long', audience: ['reader'], brought: ['reader'] },
      { id: 'e2', kind: 'participantResponse', participantId: 'reader', causeId: 'e1', outcome: 'commentary', claim: 'It runs long.' },
    ])

    await screen.findByText('It runs long.')

    expect(screen.getByText('ROOM CHANGED')).toBeTruthy()
    expect(screen.getByText('Reader Experience was addressed and is now in the room.')).toBeTruthy()

    cleanup()
    renderConversation([RESPONSE_WITH_COMMENTARY])

    await screen.findByText('It holds.')
    expect(screen.queryByText('ROOM CHANGED')).toBeNull()
  })

  it('counts the room the addressing left behind, in the singular where it holds one specialist', async () => {
    renderConversation([
      { id: 'e1', kind: 'authorMessage', text: '@reader and @shape', audience: ['reader', 'shape'], brought: ['reader', 'shape'], castSize: 4 },
      { id: 'e2', kind: 'participantResponse', participantId: 'reader', causeId: 'e1', outcome: 'commentary', claim: 'It runs long.' },
    ])

    await screen.findByText('It runs long.')
    expect(
      screen.getByText('Reader Experience, Shape were addressed and are now in the room. The room holds 4 specialists.'),
    ).toBeTruthy()

    cleanup()
    renderConversation([
      { id: 'e1', kind: 'authorMessage', text: '@reader alone', audience: ['reader'], brought: ['reader'], castSize: 1 },
      { id: 'e2', kind: 'participantResponse', participantId: 'reader', causeId: 'e1', outcome: 'commentary', claim: 'It runs long.' },
    ])

    await screen.findByText('It runs long.')
    expect(
      screen.getByText('Reader Experience was addressed and is now in the room. The room holds 1 specialist.'),
    ).toBeTruthy()
  })
})

const RESPONSE_WITH_RECOMMENDATION: ConversationEntryView = {
  id: 'e1',
  kind: 'participantResponse',
  participantId: 'shape',
  causeId: 'e0',
  outcome: 'applicableSuggestion',
  claim: 'cut the second paragraph',
}

function application(change: ApplicationEntryView['change']): RoomEvent {
  return {
    type: 'entry.appended',
    data: { actionId: 'a1', entry: { id: 'e-app1', kind: 'application', responseId: 'e1', changeId: 'change1', change }, surface: 'draft' },
  }
}

describe('the applied change, shown on its originating response', () => {
  afterEach(cleanup)

  it('opens disclosed on the author applying it, and closes to an unambiguous summary', async () => {
    const { room, stream } = roomStreaming([RESPONSE_WITH_RECOMMENDATION])

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
    stream(application({ kind: 'passages', passages: [{ leading: '', before: 'the old line', after: 'the new line', trailing: '' }] }))

    const toggle = await screen.findByRole('button', { name: 'APPLIED · 3 WORDS' })
    expect(screen.getByText('the old line')).toBeTruthy()
    expect(screen.getByText('the new line')).toBeTruthy()

    fireEvent.click(toggle)

    expect(screen.queryByText('the old line')).toBeNull()
  })

  it('counts a passage by the greater of its removed and added words, never the context around it', async () => {
    const { room, stream } = roomStreaming([RESPONSE_WITH_RECOMMENDATION])

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
    stream(
      application({
        kind: 'passages',
        passages: [
          {
            leading: 'Plenty of unchanged prose sits before this. ',
            before: 'one two three four five six seven eight nine ten',
            after: '',
            trailing: ' And plenty more sits after it.',
          },
          { leading: '', before: '', after: 'brand new sentence arrived', trailing: '' },
          { leading: '', before: 'short', after: 'a longer replacement text here', trailing: '' },
        ],
      }),
    )

    await screen.findByRole('button', { name: 'APPLIED · 19 WORDS · 3 PASSAGES' })
  })

  it('states a change with nothing to disclose, offering no toggle, and still shows the application when the change file is gone', async () => {
    const rewritten = roomStreaming([RESPONSE_WITH_RECOMMENDATION])
    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room: rewritten.room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
    rewritten.stream(application({ kind: 'rewrittenWhole' }))

    await screen.findByText('APPLIED · REWRITTEN WHOLE')
    expect(screen.queryByRole('button', { name: /APPLIED/ })).toBeNull()

    cleanup()
    const missing = roomStreaming([RESPONSE_WITH_RECOMMENDATION])
    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room: missing.room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
    missing.stream(application(undefined))

    await screen.findByText('APPLIED · CHANGE FILE MISSING')
    expect(screen.getByRole('button', { name: 'ask the room about this' })).toBeTruthy()
  })

  it('asks the room about the change as an ordinary message the author does not have to compose', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a2' } }),
    )
    const streaming = roomStreaming([RESPONSE_WITH_RECOMMENDATION])
    const room: RoomAdapters = { ...streaming.room, dispatch }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
    streaming.stream(application({ kind: 'passages', passages: [{ leading: '', before: 'the old line', after: 'the new line', trailing: '' }] }))
    fireEvent.click(await screen.findByRole('button', { name: 'ask the room about this' }))

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        'the-lighthouse',
        'draft',
        'c1',
        { message: 'Take a look at the change I just made and tell me what you think.' },
        DOCUMENTS,
        expect.any(AbortSignal),
      ),
    )
  })

  it('asks the declared interviewer for a question by addressing it in words the author could have typed', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    const room: RoomAdapters = { ...roomHolding([]), dispatch }

    renderConversation([], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'ask me' }))

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        'the-lighthouse',
        'draft',
        'c1',
        { message: `@${INTERVIEWER.handle} ${INTERVIEWER.invocation}` },
        DOCUMENTS,
        expect.any(AbortSignal),
      ),
    )
  })
})

describe('replying to a response', () => {
  afterEach(cleanup)

  it('empty, addresses that participant in the main input and focuses it', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    fireEvent.click(await screen.findByRole('button', { name: 'reply' }))

    const composer = await screen.findByLabelText('Message the room')
    await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe('@shape '))
    expect(document.activeElement).toBe(composer)
  })

  it('with text, sends it to that participant immediately rather than focusing the composer', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_COMMENTARY]), dispatch }

    renderConversation([RESPONSE_WITH_COMMENTARY], { room })

    const field = await screen.findByLabelText('Reply or ask for a concrete change, in your own words')
    fireEvent.change(field, { target: { value: 'say more about that' } })
    fireEvent.click(screen.getByRole('button', { name: 'reply' }))

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', { target: 'shape', message: 'say more about that' }, DOCUMENTS, expect.any(AbortSignal)),
    )
    expect((field as HTMLInputElement).value).toBe('')

    expect((screen.getByLabelText('Message the room') as HTMLTextAreaElement).value).toBe('')
  })
})

describe('asking for a concrete change', () => {
  afterEach(cleanup)

  it("is offered on a reading that carried no action, and not on an applicable suggestion, which offers Apply instead", async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    await screen.findByText('It holds.')
    expect(screen.getByRole('button', { name: 'ask for a concrete change' })).toBeTruthy()

    cleanup()
    renderConversation([RESPONSE_WITH_RECOMMENDATION])

    await screen.findByRole('button', { name: 'apply' })
    expect(screen.queryByRole('button', { name: 'ask for a concrete change' })).toBeNull()
  })

  it('opens an ordinary dispatch carrying no author message, naming the response it came from and any text left in the shared field', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_COMMENTARY]), dispatch }

    renderConversation([RESPONSE_WITH_COMMENTARY], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'ask for a concrete change' }))
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', { respondingTo: 'e0', clarification: undefined }, DOCUMENTS, expect.any(AbortSignal)),
    )

    cleanup()
    renderConversation([RESPONSE_WITH_COMMENTARY], { room })

    const field = await screen.findByLabelText('Reply or ask for a concrete change, in your own words')
    fireEvent.change(field, { target: { value: 'what would you cut' } })
    fireEvent.click(screen.getByRole('button', { name: 'ask for a concrete change' }))

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', { respondingTo: 'e0', clarification: 'what would you cut' }, DOCUMENTS, expect.any(AbortSignal)),
    )
  })

  it('shows the naming at the entry it occupies, in place of the author message a concrete-change request never had', async () => {
    renderConversation([
      { id: 'e1', kind: 'concreteChangeRequest', target: 'shape', respondingTo: 'e0' },
      { id: 'e2', kind: 'participantResponse', participantId: 'shape', causeId: 'e1', outcome: 'applicableSuggestion', claim: 'cut the aside' },
    ])

    await screen.findByText('cut the aside')

    expect(screen.getByText('Shape was asked for a concrete change.')).toBeTruthy()
  })
})

describe('one response-local field shared by every action on the response', () => {
  afterEach(cleanup)

  it('carries text left in the shared field as the constraint when Apply is chosen', async () => {
    const applyRecommendation = vi.fn(() =>
      Promise.resolve({
        outcome: 'value' as const,
        value: { outcome: 'noChange' as const, actionId: 'a1' },
      }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_RECOMMENDATION]), applyRecommendation }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    const field = await screen.findByLabelText('Reply or apply, in your own words')
    fireEvent.change(field, { target: { value: 'keep the last line' } })
    fireEvent.click(screen.getByRole('button', { name: 'apply' }))

    await waitFor(() => expect(applyRecommendation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'e1', DOCUMENTS, 'keep the last line', expect.any(AbortSignal)))
  })

  it('sends the text exactly as typed, whitespace and all', async () => {
    const applyRecommendation = vi.fn(() =>
      Promise.resolve({
        outcome: 'value' as const,
        value: { outcome: 'noChange' as const, actionId: 'a1' },
      }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_RECOMMENDATION]), applyRecommendation }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    const field = await screen.findByLabelText('Reply or apply, in your own words')
    fireEvent.change(field, { target: { value: '  keep the last line  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'apply' }))

    await waitFor(() =>
      expect(applyRecommendation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'e1', DOCUMENTS, '  keep the last line  ', expect.any(AbortSignal)),
    )
  })

  it('leaves a field holding only whitespace out of the action entirely', async () => {
    const applyRecommendation = vi.fn(() =>
      Promise.resolve({
        outcome: 'value' as const,
        value: { outcome: 'noChange' as const, actionId: 'a1' },
      }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_RECOMMENDATION]), applyRecommendation }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    const field = await screen.findByLabelText('Reply or apply, in your own words')
    fireEvent.change(field, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'apply' }))

    await waitFor(() =>
      expect(applyRecommendation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'e1', DOCUMENTS, undefined, expect.any(AbortSignal)),
    )
  })
})

describe('handle completion at the composer', () => {
  afterEach(cleanup)

  it('offers only the handles the token prefix-matches, completes the one chosen into the message, and closes the offer', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: '@sh' } })

    const suggestion = await screen.findByRole('option', { name: /@shape/ })
    expect(screen.queryByRole('option', { name: /@reader/ })).toBeNull()
    fireEvent.click(suggestion)

    await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe('@shape '))
    expect(screen.queryByRole('option')).toBeNull()
  })
})

describe('sending from the keyboard', () => {
  afterEach(cleanup)

  it('sends on Enter, leaves Shift+Enter for a newline, and does nothing while the send control is disabled', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    const room: RoomAdapters = { ...roomHolding([]), dispatch }

    renderConversation([], { room })

    const composer = await screen.findByLabelText('Message the room')

    fireEvent.keyDown(composer, { key: 'Enter' })
    expect(dispatch).not.toHaveBeenCalled()

    fireEvent.change(composer, { target: { value: 'a message' } })

    expect(fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true })).toBe(true)
    expect(dispatch).not.toHaveBeenCalled()

    expect(fireEvent.keyDown(composer, { key: 'Enter' })).toBe(false)
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', { message: 'a message' }, DOCUMENTS, expect.any(AbortSignal)))
  })

  it('leaves a control inside the composer to handle its own Enter, rather than submitting the message', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    const room: RoomAdapters = { ...roomHolding([]), dispatch }

    renderConversation([], { room })

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: 'a message' } })

    fireEvent.keyDown(await screen.findByRole('button', { name: 'ask me' }), { key: 'Enter' })

    expect(dispatch).not.toHaveBeenCalled()
    expect((composer as HTMLTextAreaElement).value).toBe('a message')
  })
})
