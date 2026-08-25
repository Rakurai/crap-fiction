import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationEntryView } from '../../../src/shared/conversationEntryViews.js'
import { Conversation } from '../../../src/client/Conversation.js'
import styles from '../../../src/client/Conversation.module.css'
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
      mark={() => 'var(--mark-teal)'}
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

  it('sets a claim and its note apart: two blocks in two registers, not one sentence trailing the other', async () => {
    renderConversation([
      { id: 'e1', kind: 'authorMessage', text: 'what isn’t working about the ending', audience: [], brought: [] },
      {
        id: 'e2',
        kind: 'participantResponse',
        participantId: 'shape',
        causeId: 'e1',
        outcome: 'commentary',
        claim: 'The ending arrives before the fear does.',
        note: 'Three paragraphs earlier the light is already gone.',
      },
    ])

    const claim = await screen.findByText('The ending arrives before the fear does.')
    const note = screen.getByText('Three paragraphs earlier the light is already gone.')

    expect(claim.textContent).not.toContain('Three paragraphs')
    expect(note).not.toBe(claim)
    expect(claim.contains(note)).toBe(false)
    expect(note.contains(claim)).toBe(false)
  })

  it('carries the participant\'s identity beside what it said, by name and not by id', async () => {
    renderConversation([
      { id: 'e1', kind: 'participantResponse', participantId: 'reader', causeId: 'e0', outcome: 'commentary', claim: 'I lost the room in the second turn.' },
    ])

    await screen.findByText('I lost the room in the second turn.')

    expect(screen.getByText('Reader Experience')).toBeTruthy()
    expect(screen.queryByText('reader')).toBeNull()
    expect(blockContaining('I lost the room in the second turn.').textContent).toContain('Reader Experience')
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

  it("states a failed call in the machine's register under the participant that did not answer", async () => {
    renderConversation([{ id: 'e1', kind: 'participantFailure', participantId: 'shape', causeId: 'e0', reason: 'timeout' }])

    await waitFor(() => expect(screen.getByText(/did not answer/)).toBeTruthy())

    expect(screen.getByText('did not answer — TIMEOUT')).toBeTruthy()
    expect(blockContaining('did not answer — TIMEOUT').textContent).toContain('Shape')
  })

  it('shows what a failed call returned, where anything came back', async () => {
    renderConversation([
      { id: 'e1', kind: 'participantFailure', participantId: 'shape', causeId: 'e0', reason: 'nonconforming', returned: '{"claim": "the ending' },
    ])

    await waitFor(() => expect(screen.getByText('{"claim": "the ending')).toBeTruthy())
  })

  it('draws a failure in its own machine-status class, never the note register it could be mistaken for', async () => {
    renderConversation([
      { id: 'e1', kind: 'participantFailure', participantId: 'shape', causeId: 'e0', reason: 'timeout' },
      { id: 'e2', kind: 'participantResponse', participantId: 'reader', causeId: 'e0', outcome: 'commentary', claim: 'It holds.', note: 'A quiet note.' },
    ])

    const failed = await screen.findByText('did not answer — TIMEOUT')
    const note = await screen.findByText('A quiet note.')

    expect(failed.className).toBe(styles.failed)
    expect(failed.className).not.toBe(styles.note)
    expect(note.className).toBe(styles.note)
  })
})

describe('a room that cannot be reached', () => {
  afterEach(cleanup)

  it('says so at the composer, and says what is still true', async () => {
    renderConversation([], { runtime: { reachable: false } })

    await waitFor(() => expect(screen.getByText('ROOM UNAVAILABLE')).toBeTruthy())
    expect(screen.getByText('No model is reachable. The manuscript is yours to write.')).toBeTruthy()
  })

  it('says nothing while nothing has been heard either way', async () => {
    renderConversation([{ id: 'e1', kind: 'participantResponse', participantId: 'shape', causeId: 'e0', outcome: 'commentary', claim: 'It holds.' }], {
      runtime: undefined,
    })

    await screen.findByText('It holds.')

    expect(screen.queryByText('ROOM UNAVAILABLE')).toBeNull()
  })
})

describe('a specialist the addressing brought into the room', () => {
  afterEach(cleanup)

  it('says which one, beside the message that brought it in', async () => {
    renderConversation([
      { id: 'e1', kind: 'authorMessage', text: '@reader is this scene too long', audience: ['reader'], brought: ['reader'] },
      { id: 'e2', kind: 'participantResponse', participantId: 'reader', causeId: 'e1', outcome: 'commentary', claim: 'It runs long.' },
    ])

    await screen.findByText('It runs long.')

    expect(screen.getByText('ROOM CHANGED')).toBeTruthy()
    expect(screen.getByText('Reader Experience was addressed and is now in the room.')).toBeTruthy()
  })

  it('says nothing where addressing changed nothing', async () => {
    renderConversation([{ id: 'e1', kind: 'participantResponse', participantId: 'shape', causeId: 'e0', outcome: 'commentary', claim: 'It holds.' }])

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

describe('the applied change, shown on its originating response', () => {
  afterEach(cleanup)

  it('opens disclosed on the author applying it, and closes to an unambiguous summary', async () => {
    const room: RoomAdapters = {
      ...roomHolding([RESPONSE_WITH_RECOMMENDATION]),
      applyRecommendation: () =>
        Promise.resolve({
          outcome: 'value',
          value: {
            outcome: 'applied',
            actionId: 'a1',
            entryId: 'e-app1',
            manuscript: 'the revised manuscript',
            change: { id: 'change1', content: { kind: 'passages', passages: [{ before: 'the old line', after: 'the new line' }] } },
          },
        }),
    }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))

    const toggle = await screen.findByRole('button', { name: 'APPLIED · 3 WORDS' })
    expect(screen.getByText('the old line')).toBeTruthy()
    expect(screen.getByText('the new line')).toBeTruthy()
    // The response that caused the change still carries its own actions — Apply created no
    // participant follow-up, and the change is presented on the response rather than as a new item.
    expect(screen.getByRole('button', { name: 'apply' })).toBeTruthy()

    fireEvent.click(toggle)

    expect(screen.queryByText('the old line')).toBeNull()
  })

  it('presents a whole-manuscript rewrite as the bare statement, with nothing to disclose', async () => {
    const room: RoomAdapters = {
      ...roomHolding([RESPONSE_WITH_RECOMMENDATION]),
      applyRecommendation: () =>
        Promise.resolve({
          outcome: 'value',
          value: {
            outcome: 'applied',
            actionId: 'a1',
            entryId: 'e-app1',
            manuscript: 'an entirely different piece',
            change: { id: 'change1', content: { kind: 'rewrittenWhole' } },
          },
        }),
    }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))

    await screen.findByText('APPLIED · REWRITTEN WHOLE')
    expect(screen.queryByRole('button', { name: /APPLIED/ })).toBeNull()
  })

  it('asks the room about the change as an ordinary message the author does not have to compose', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a2' } }),
    )
    const room: RoomAdapters = {
      ...roomHolding([RESPONSE_WITH_RECOMMENDATION]),
      dispatch,
      applyRecommendation: () =>
        Promise.resolve({
          outcome: 'value',
          value: {
            outcome: 'applied',
            actionId: 'a1',
            entryId: 'e-app1',
            manuscript: 'the revised manuscript',
            change: { id: 'change1', content: { kind: 'passages', passages: [{ before: 'the old line', after: 'the new line' }] } },
          },
        }),
    }

    renderConversation([RESPONSE_WITH_RECOMMENDATION], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
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

  it('is offered on a response that offered a reading without an action', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    await screen.findByText('It holds.')

    expect(screen.getByRole('button', { name: 'ask for a concrete change' })).toBeTruthy()
  })

  it('is not offered on an applicable suggestion, which offers Apply instead', async () => {
    renderConversation([RESPONSE_WITH_RECOMMENDATION])

    await screen.findByRole('button', { name: 'apply' })

    expect(screen.queryByRole('button', { name: 'ask for a concrete change' })).toBeNull()
  })

  it('opens an ordinary dispatch carrying no author message, naming the response it came from', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_COMMENTARY]), dispatch }

    renderConversation([RESPONSE_WITH_COMMENTARY], { room })

    fireEvent.click(await screen.findByRole('button', { name: 'ask for a concrete change' }))

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith('the-lighthouse', 'c1', { respondingTo: 'e0', clarification: undefined }, 'First light.'),
    )
  })

  it('carries text left in the shared field as the clarification', async () => {
    const dispatch = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; actionId: string }>>({ outcome: 'value', value: { conversationId: 'c1', actionId: 'a1' } }),
    )
    const room: RoomAdapters = { ...roomHolding([RESPONSE_WITH_COMMENTARY]), dispatch }

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

  it('offers exactly one text field on a response that offered a reading, serving both reply and asking for a concrete change', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    await screen.findByText('It holds.')

    expect(screen.getAllByRole('textbox')).toHaveLength(1) // the one shared field on the response
  })

  it('offers exactly one text field on a response that recommends something concrete, serving both reply and apply', async () => {
    renderConversation([RESPONSE_WITH_RECOMMENDATION])

    await screen.findByRole('button', { name: 'apply' })

    expect(screen.getAllByRole('textbox')).toHaveLength(1) // the one shared field on the response
  })

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

    expect(await screen.findByText('@shape')).toBeTruthy()
    expect(screen.queryByText('@reader')).toBeNull()
  })

  it('offers nothing for a sigil that does not begin the message or follow whitespace', async () => {
    renderConversation([RESPONSE_WITH_COMMENTARY])

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: 'mail@sh' } })

    expect(screen.queryByText('@shape')).toBeNull()
  })

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

  it('ACTIVE-ESCAPE: shows an unconditional activity signal and a distinct Abandon control the instant a dispatch opens, before any participant reports progress', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    stream(STARTED)

    expect(await screen.findByRole('button', { name: 'abandon' })).toBeTruthy()
    expect(screen.getByText(/ACTIVE/)).toBeTruthy()
    expect(screen.queryByText(/is thinking/)).toBeNull()
  })

  it('PROGRESS-REAL, NO-WAITING-PLACES: one "is thinking" line per participant actually reporting progress, none for the rest of a resolved audience it never got', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    stream(STARTED)
    stream({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'shape', state: 'working' } })

    expect(await screen.findByText('Shape is thinking.')).toBeTruthy()
    expect(screen.queryByText(/Reader Experience is thinking/)).toBeNull()
    expect(screen.queryByText(/waiting/i)).toBeNull()
  })

  it('PROGRESS-PARALLEL: several concurrently active participants each draw their own line', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    stream(STARTED)
    stream({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'shape', state: 'working' } })
    stream({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'reader', state: 'preparing' } })

    expect(await screen.findByText('Shape is thinking.')).toBeTruthy()
    expect(screen.getByText('Reader Experience is thinking.')).toBeTruthy()
  })

  it('a landed entry clears that participant\'s line without disturbing the unconditional signal', async () => {
    const { room, stream } = roomStreaming([])
    renderConversation([], { room })

    stream(STARTED)
    stream({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'shape', state: 'working' } })
    await screen.findByText('Shape is thinking.')

    stream({
      type: 'entry.appended',
      data: { actionId: 'a1', entry: { id: 'e1', kind: 'participantNoComment', participantId: 'shape', causeId: 'e0' } },
    })

    await waitFor(() => expect(screen.queryByText('Shape is thinking.')).toBeNull())
    expect(screen.getByRole('button', { name: 'abandon' })).toBeTruthy()
  })

  it('ACTION-EXCLUSION: disables send while busy without relabelling it or collapsing its geometry', async () => {
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

    expect(abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'c1', 'a1')
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

    // A model callback settling after this client already released controls — untracked
    // server-side by ABANDON-UNTRACK, so this is what a race with it looks like here — must not
    // reopen the activity this client already tore down.
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
