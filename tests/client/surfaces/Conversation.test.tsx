import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApplicationEntryView, ConversationEntryView } from '../../../src/shared/conversationEntryViews.js'
import { Conversation } from '../../../src/client/Conversation.js'
import type { RoomEvent } from '../../../src/client/entryProjection.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomAdapters } from '../../../src/client/useConversation.js'

const NAMES: Record<string, string> = { shape: 'Shape', reader: 'Reader Experience', editor: 'Story Editor' }

const HANDLES = [
  { handle: 'shape', displayName: 'Shape' },
  { handle: 'reader', displayName: 'Reader Experience' },
  { handle: 'editor', displayName: 'Story Editor' },
]

const HANDLE_BY_ID: Record<string, string> = { shape: 'shape', reader: 'reader', editor: 'editor' }

function roomHolding(
  entries: readonly ConversationEntryView[],
  abandonOperation: RoomAdapters['abandonOperation'] = () => Promise.resolve({ outcome: 'value', value: null }),
): RoomAdapters {
  return {
    subscribeToRoom: () => () => {},
    createConversation: () => Promise.resolve({ outcome: 'value', value: { id: 'c1' } }),
    fetchConversation: () => Promise.resolve({ outcome: 'value', value: { id: 'c1', entries } }),
    dispatch: () => Promise.resolve({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    abandonOperation,
    applyRecommendation: () =>
      Promise.resolve({ outcome: 'value', value: { outcome: 'applied', actionId: 'a1', manuscript: 'the revised manuscript' } }),
  }
}

function renderConversation(entries: readonly ConversationEntryView[], extra: Partial<ComponentProps<typeof Conversation>> = {}) {
  return render(
    <Conversation
      pieceId="the-lighthouse"
      currentConversationId="c1"
      conversationActionInFlight={null}
      draft="First light."
      flushDraft={() => {}}
      room={roomHolding(entries)}
      displayName={(id) => NAMES[id] ?? id}
      handle={(id) => HANDLE_BY_ID[id]}
      handles={HANDLES}
      runtime={{ reachable: true }}
      clock={() => 1_700_000_000_000}
      {...extra}
    />,
  )
}

function roomStreaming(
  entries: readonly ConversationEntryView[],
  abandonOperation: RoomAdapters['abandonOperation'] = () => Promise.resolve({ outcome: 'value', value: null }),
): { room: RoomAdapters; stream: (event: RoomEvent) => void } {
  let deliver: (event: RoomEvent) => void = () => {
    throw new Error('the room was never subscribed to')
  }
  const room: RoomAdapters = {
    ...roomHolding(entries, abandonOperation),
    subscribeToRoom: (_pieceId, onEvent) => {
      deliver = onEvent
      return () => {}
    },
  }
  return { room, stream: (event) => act(() => deliver(event)) }
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

    // Identity is carried on the handle the author would address, with the display name secondary.
    const block = blockContaining('The ending arrives before the fear does.').textContent
    expect(block).toContain('@reader')
    expect(block).toContain('Reader Experience')
  })

  it('draws nothing at all for a no-comment outcome — not a row, not a name, not a placeholder', async () => {
    renderConversation([
      { id: 'e1', kind: 'participantNoComment', participantId: 'shape', causeId: 'e0' },
      { id: 'e2', kind: 'participantResponse', participantId: 'editor', causeId: 'e0', outcome: 'commentary', claim: 'It holds.' },
    ])

    await screen.findByText('It holds.')

    expect(screen.queryByText('Shape')).toBeNull()
    expect(screen.getByText('Story Editor')).toBeTruthy()
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
  return { type: 'entry.appended', data: { actionId: 'a1', entry: { id: 'e-app1', kind: 'application', responseId: 'e1', changeId: 'change1', change } } }
}

describe('the applied change, shown on its originating response', () => {
  afterEach(cleanup)

  it('opens disclosed on the author applying it, and closes to an unambiguous summary', async () => {
    const { room, stream } = roomStreaming([RESPONSE_WITH_RECOMMENDATION])

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
    stream(application({ kind: 'passages', passages: [{ before: 'the old line', after: 'the new line' }] }))

    const toggle = await screen.findByRole('button', { name: 'APPLIED · 3 WORDS' })
    expect(screen.getByText('the old line')).toBeTruthy()
    expect(screen.getByText('the new line')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'apply' })).toBeTruthy()

    fireEvent.click(toggle)

    expect(screen.queryByText('the old line')).toBeNull()
  })

  /**
   * A change with no passages to show is stated rather than disclosed, whether because it
   * rewrote the whole manuscript or because the file naming it is gone. The application
   * itself still stands either way.
   */
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
    streaming.stream(application({ kind: 'passages', passages: [{ before: 'the old line', after: 'the new line' }] }))
    fireEvent.click(await screen.findByRole('button', { name: 'ask the room about this' }))

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        'the-lighthouse',
        'c1',
        { message: 'Take a look at the change I just made and tell me what you think.' },
        'First light.',
      ),
    )
  })
})

const RESPONSE_WITH_COMMENTARY: ConversationEntryView = {
  id: 'e0',
  kind: 'participantResponse',
  participantId: 'shape',
  causeId: 'e-1',
  outcome: 'commentary',
  claim: 'It holds.',
}

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
      expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'c1', { target: 'shape', message: 'say more about that' }, 'First light.'),
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
      expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'c1', { respondingTo: 'e0', clarification: undefined }, 'First light.'),
    )

    // A fresh surface: the first dispatch leaves this one busy until the room reports back.
    cleanup()
    renderConversation([RESPONSE_WITH_COMMENTARY], { room })

    const field = await screen.findByLabelText('Reply or ask for a concrete change, in your own words')
    fireEvent.change(field, { target: { value: 'what would you cut' } })
    fireEvent.click(screen.getByRole('button', { name: 'ask for a concrete change' }))

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'c1', { respondingTo: 'e0', clarification: 'what would you cut' }, 'First light.'),
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

  // That there is one field per response, labelled for the actions that response carries, is
  // stated by the labels the tests above and below reach for.
  it('carries text left in the shared field as the constraint when Apply is chosen', async () => {
    const applyRecommendation = vi.fn(() =>
      Promise.resolve({
        outcome: 'value' as const,
        value: { outcome: 'applied' as const, actionId: 'a1', entryId: 'e-app1', manuscript: 'revised', change: undefined },
      }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_RECOMMENDATION]), applyRecommendation }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    const field = await screen.findByLabelText('Reply or apply, in your own words')
    fireEvent.change(field, { target: { value: 'keep the last line' } })
    fireEvent.click(screen.getByRole('button', { name: 'apply' }))

    await waitFor(() => expect(applyRecommendation).toHaveBeenCalledWith('the-lighthouse', 'c1', 'e1', 'First light.', 'keep the last line'))
  })
})

describe('handle completion at the composer', () => {
  afterEach(cleanup)

  it('offers every handle the token prefix-matches, as the author types one', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: '@sh' } })

    expect(await screen.findByRole('option', { name: /@shape/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /@reader/ })).toBeNull()
  })

  // Where a sigil counts as beginning a mention at all is the shared `@handle` grammar's
  // claim, held at `client/mentionTrigger.test.ts`, not this surface's.
  it('completes the token into the message, and closes the offer', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: '@sh' } })

    const suggestion = await screen.findByRole('option', { name: /@shape/ })
    fireEvent.click(suggestion)

    await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe('@shape '))
    expect(screen.queryByRole('option')).toBeNull()
  })
})

describe('conversation activity, truthfully', () => {
  afterEach(cleanup)

  const STARTED: RoomEvent = {
    type: 'action.started',
    data: { actionId: 'a1', conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e0', startedAt: 1_700_000_000_000, audience: ['shape', 'reader'] },
  }

  it('ACTIVE-ESCAPE: offers an actionable Abandon control and an unconditional activity signal the instant a dispatch opens, before any participant reports progress', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    stream(STARTED)

    expect(await screen.findByRole('button', { name: 'abandon' })).toBeTruthy()
    expect(screen.getByText(/ACTIVE/)).toBeTruthy()
    expect(screen.queryByText(/is thinking/)).toBeNull()
  })

  it('PROGRESS-REAL, PROGRESS-PARALLEL, NO-WAITING-PLACES: one "is thinking" line per participant actually reporting progress, and none for the rest of a resolved audience it never got', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    stream(STARTED)
    stream({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'shape', state: 'working' } })

    expect(await screen.findByText('Shape is thinking.')).toBeTruthy()
    // The audience STARTED resolved holds `reader` too, which has reported nothing.
    expect(screen.queryByText(/Reader Experience is thinking/)).toBeNull()
    expect(screen.queryByText(/waiting/i)).toBeNull()

    stream({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'reader', state: 'preparing' } })

    expect(screen.getByText('Shape is thinking.')).toBeTruthy()
    expect(screen.getByText('Reader Experience is thinking.')).toBeTruthy()
  })

  it('ACTION-EXCLUSION: disables send while busy without relabelling it', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    const send = (await screen.findByRole('button', { name: 'send' })) as HTMLButtonElement
    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: 'a message' } })
    expect(send.disabled).toBe(false)

    stream(STARTED)

    await waitFor(() => expect(send.disabled).toBe(true))
    expect(send.textContent).toBe('send')
  })

  it('ABANDON-UNTRACK: targets the action by identity and releases controls immediately, without waiting for the request to resolve', async () => {
    const abandonOperation = vi.fn(() => new Promise<RequestResult<null>>(() => {}))
    const { room, stream } = roomStreaming([], abandonOperation)
    renderConversation([], { room })

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: 'a message' } })

    stream(STARTED)
    const abandon = await screen.findByRole('button', { name: 'abandon' })
    fireEvent.click(abandon)

    expect(screen.queryByRole('button', { name: 'abandon' })).toBeNull()
    expect(screen.queryByText(/ACTIVE/)).toBeNull()
    expect((screen.getByRole('button', { name: 'send' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('ABANDON-KEEP-LANDED: an entry accepted before abandonment stays, and a late progress callback for the same action cannot resurrect its activity', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    stream(STARTED)
    stream({
      type: 'entry.appended',
      data: { actionId: 'a1', entry: { id: 'e1', kind: 'participantResponse', participantId: 'shape', causeId: 'e0', outcome: 'commentary', claim: 'It holds.' } },
    })
    await screen.findByText('It holds.')

    fireEvent.click(screen.getByRole('button', { name: 'abandon' }))
    expect(screen.queryByRole('button', { name: 'abandon' })).toBeNull()

    stream({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'reader', state: 'working' } })

    expect(screen.getByText('It holds.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'abandon' })).toBeNull()
    expect(screen.queryByText(/is thinking/)).toBeNull()
  })

  it('reconnect: an apply already in flight for a response shows its flight from the piece snapshot alone, no new event required', async () => {
    renderConversation([RESPONSE_WITH_RECOMMENDATION], {
      conversationActionInFlight: { actionId: 'a1', conversationId: 'c1', kind: 'apply', sourceEntryId: 'e1', startedAt: 1_700_000_000_000 },
    })

    expect(await screen.findByText('APPLYING')).toBeTruthy()
  })
})
