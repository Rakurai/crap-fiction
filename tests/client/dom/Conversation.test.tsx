import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Conversation as ConversationRecord, ConversationView, RoundRecord } from '../../../src/shared/conversationViews.js'
import { Conversation } from '../../../src/client/Conversation.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { RoomAdapters } from '../../../src/client/useConversation.js'

const NAMES: Record<string, string> = { shape: 'Shape', reader: 'Reader Experience', editor: 'Story Editor' }

const HANDLES = [
  { handle: 'shape', displayName: 'Shape' },
  { handle: 'reader', displayName: 'Reader Experience' },
  { handle: 'editor', displayName: 'Story Editor' },
]

/**
 * What a fixture built as `RoundRecord`s reads back as once `getConversation`
 * has resolved it — CONTEXT "Applied change": a conversation fresh off disk
 * names no applied change until the store attaches one, which is exactly
 * what a bare fixture is.
 */
function toView(conversation: ConversationRecord): ConversationView {
  return {
    id: conversation.id,
    rounds: conversation.rounds.map((round) => ({
      ...round,
      participants: round.participants.map((participant) => ({ ...participant, appliedChanges: [] })),
    })),
  }
}

/**
 * The room, stood still: this surface is being read, not driven, so the stream
 * yields nothing and the conversation is whatever the fixture recorded. Sending a
 * message is exercised where it is decided — `useConversation` and `Room`.
 */
function roomHolding(conversation: ConversationRecord, abandonOperation: RoomAdapters['abandonOperation'] = () => Promise.resolve({ outcome: 'value', value: null })): RoomAdapters {
  return {
    subscribeToRoom: () => () => {},
    createConversation: () => Promise.resolve({ outcome: 'value', value: { id: conversation.id } }),
    fetchConversation: () => Promise.resolve({ outcome: 'value', value: toView(conversation) }),
    startRound: () => Promise.resolve({ outcome: 'value', value: { conversationId: conversation.id, roundId: 'r1' } }),
    abandonOperation,
    applyRecommendation: () => Promise.resolve({ outcome: 'value', value: { outcome: 'applied', manuscript: 'the revised manuscript' } }),
  }
}

const HANDLE_BY_ID: Record<string, string> = { shape: 'shape', reader: 'reader', editor: 'editor' }

/**
 * A moment, stated. The elapsed count is read from `clock`, so a test that wants
 * `0:14` on screen says which fourteen seconds rather than sleeping through them.
 */
const OPENED_AT = 1_700_000_000_000

function renderConversation(round: RoundRecord, extra: Partial<ComponentProps<typeof Conversation>> = {}) {
  const conversation: ConversationRecord = { id: 'c1', rounds: [round] }
  return render(
    <Conversation
      pieceId="the-lighthouse"
      currentConversationId="c1"
      roundInFlight={null}
      draft="First light."
      flushDraft={() => {}}
      room={roomHolding(conversation)}
      displayName={(id) => NAMES[id] ?? id}
      mark={() => 'var(--mark-teal)'}
      handle={(id) => HANDLE_BY_ID[id]}
      handles={HANDLES}
      runtime={{ reachable: true, models: ['a-model'] }}
      clock={() => OPENED_AT}
      {...extra}
    />,
  )
}

/** The block a response was drawn in: what carries its identity and what it said. */
function blockContaining(text: string): HTMLElement {
  const said = screen.getByText(text)
  const block = said.parentElement
  if (block === null) throw new Error(`"${text}" was drawn with no block around it`)
  return block
}

describe('a settled round in the conversation', () => {
  afterEach(cleanup)

  it('sets a claim and its note apart: two blocks in two registers, not one sentence trailing the other', async () => {
    renderConversation({
      id: 'r1',
      message: 'what isn’t working about the ending',
      addressed: [],
      brought: [],
      participants: [
        {
          participantId: 'shape',
          result: { kind: 'response', outcome: 'commentary', claim: 'The ending arrives before the fear does.', note: 'Three paragraphs earlier the light is already gone.' },
        },
      ],
      outcome: 'settled',
    })

    const claim = await screen.findByText('The ending arrives before the fear does.')
    const note = screen.getByText('Three paragraphs earlier the light is already gone.')

    expect(claim.textContent).not.toContain('Three paragraphs')
    expect(note).not.toBe(claim)
    expect(claim.contains(note)).toBe(false)
    expect(note.contains(claim)).toBe(false)
  })

  it('carries the participant\'s identity beside what it said, by name and not by id', async () => {
    renderConversation({
      id: 'r1',
      addressed: [],
      brought: [],
      participants: [{ participantId: 'reader', result: { kind: 'response', outcome: 'commentary', claim: 'I lost the room in the second turn.' } }],
      outcome: 'settled',
    })

    await screen.findByText('I lost the room in the second turn.')

    expect(screen.getByText('Reader Experience')).toBeTruthy()
    expect(screen.queryByText('reader')).toBeNull()
    expect(blockContaining('I lost the room in the second turn.').textContent).toContain('Reader Experience')
  })

  it('draws nothing at all for a no-comment response — not a row, not a name, not a placeholder', async () => {
    renderConversation({
      id: 'r1',
      addressed: [],
      brought: [],
      participants: [
        { participantId: 'shape', result: { kind: 'response', outcome: 'noComment' } },
        { participantId: 'editor', result: { kind: 'response', outcome: 'commentary', claim: 'It holds.' } },
      ],
      outcome: 'settled',
    })

    await screen.findByText('It holds.')

    expect(screen.queryByText('Shape')).toBeNull()
    expect(screen.getByText('Story Editor')).toBeTruthy()
  })

  it('states a failed call in the machine\'s register under the participant that did not answer', async () => {
    renderConversation({
      id: 'r1',
      addressed: [],
      brought: [],
      participants: [{ participantId: 'shape', result: { kind: 'failed', reason: 'timeout' } }],
      outcome: 'settled',
    })

    await waitFor(() => expect(screen.getByText(/did not answer/)).toBeTruthy())

    // What came back is said in the machine's register rather than folded into a
    // sentence about the author's work, and it stands under the participant's own
    // identity rather than as an unattributed silence.
    expect(screen.getByText('did not answer — TIMEOUT')).toBeTruthy()
    expect(blockContaining('did not answer — TIMEOUT').textContent).toContain('Shape')
  })

  it('shows what a failed call returned, where anything came back', async () => {
    renderConversation({
      id: 'r1',
      addressed: [],
      brought: [],
      participants: [{ participantId: 'shape', result: { kind: 'failed', reason: 'nonconforming', returned: '{"claim": "the ending' } }],
      outcome: 'settled',
    })

    // Verbatim, not summarised and not re-cased: it is the only account the author
    // has of what the model did, and SPEC "Model access" carries it for that.
    await waitFor(() => expect(screen.getByText('{"claim": "the ending')).toBeTruthy())
  })

  it('says a round has nothing to show when every call failed, once and about the round', async () => {
    renderConversation({
      id: 'r1',
      message: 'Is the third paragraph doing enough?',
      addressed: [],
      brought: [],
      participants: [
        { participantId: 'shape', result: { kind: 'failed', reason: 'timeout' } },
        { participantId: 'reader', result: { kind: 'failed', reason: 'unreachable' } },
      ],
      outcome: 'settled',
    })

    await waitFor(() => expect(screen.getByText('Every call failed. Nothing came back, and there is no answer to show you.')).toBeTruthy())
    expect(screen.getAllByText(/Every call failed/)).toHaveLength(1)
    // Each call still says what happened to it: the round's account does not replace them.
    expect(screen.getByText('did not answer — TIMEOUT')).toBeTruthy()
    expect(screen.getByText('did not answer — UNREACHABLE')).toBeTruthy()
  })

  it('says nothing of the sort when one call answered', async () => {
    renderConversation({
      id: 'r1',
      addressed: [],
      brought: [],
      participants: [
        { participantId: 'shape', result: { kind: 'failed', reason: 'timeout' } },
        { participantId: 'editor', result: { kind: 'response', outcome: 'commentary', claim: 'It holds.' } },
      ],
      outcome: 'settled',
    })

    await screen.findByText('It holds.')

    expect(screen.queryByText(/Every call failed/)).toBeNull()
  })
})

const SETTLED_ROUND: RoundRecord = {
  id: 'r0',
  addressed: [],
  brought: [],
  participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'It holds.' } }],
  outcome: 'settled',
}

describe('a round in flight', () => {
  afterEach(cleanup)

  it('states the counts and how long it has been, in the register the machine speaks in', async () => {
    renderConversation(SETTLED_ROUND, {
      roundInFlight: {
        conversationId: 'c1',
        roundId: 'r1',
        message: 'what isn’t working about the ending',
        participants: ['shape', 'reader', 'editor'],
        brought: [],
        states: { shape: 'working' },
        settled: [],
        openedAt: OPENED_AT - 14_000,
      },
      clock: () => OPENED_AT,
    })

    // The mockup's own line, in its own order, with the counts that are zero left
    // out — `0 PREPARING` is a fact about nothing.
    await waitFor(() => expect(screen.getByText('1 WORKING · 2 WAITING · 0:14')).toBeTruthy())
  })

  it('leaves the composer writable: a round in flight is no reason to stop typing', async () => {
    renderConversation(SETTLED_ROUND, {
      roundInFlight: {
        conversationId: 'c1',
        roundId: 'r1',
        participants: ['shape'],
        brought: [],
        states: { shape: 'working' },
        settled: [],
        openedAt: OPENED_AT,
      },
    })

    const input = await screen.findByLabelText('Message the room')

    // Sending is what waits, and the button is where that is said.
    expect((input as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: '…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers abandoning for as long as the round is in flight, and asks the room for it', async () => {
    const abandonOperation = vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null }))
    const room = roomHolding({ id: 'c1', rounds: [SETTLED_ROUND] }, abandonOperation)

    renderConversation(SETTLED_ROUND, {
      room,
      roundInFlight: {
        conversationId: 'c1',
        roundId: 'r1',
        participants: ['shape'],
        brought: [],
        states: { shape: 'working' },
        settled: [],
        openedAt: OPENED_AT,
      },
    })

    const abandon = await screen.findByRole('button', { name: 'abandon' })
    fireEvent.click(abandon)

    expect(abandonOperation).toHaveBeenCalledWith('the-lighthouse')
  })

  it('offers no abandoning for a round that already settled', async () => {
    renderConversation(SETTLED_ROUND)

    await screen.findByText('It holds.')

    expect(screen.queryByRole('button', { name: 'abandon' })).toBeNull()
  })
})

describe('a room that cannot be reached', () => {
  afterEach(cleanup)

  it('says so at the composer, and says what is still true', async () => {
    renderConversation(SETTLED_ROUND, { runtime: { reachable: false } })

    await waitFor(() => expect(screen.getByText('ROOM UNAVAILABLE')).toBeTruthy())
    expect(screen.getByText('No model is reachable. The manuscript is yours to write.')).toBeTruthy()
  })

  it('says nothing while nothing has been heard either way', async () => {
    renderConversation(SETTLED_ROUND, { runtime: undefined })

    await screen.findByText('It holds.')

    // A probe that has not answered is not an unreachable room, and a notice drawn
    // from it would tell the author the room is down on this client's own silence.
    expect(screen.queryByText('ROOM UNAVAILABLE')).toBeNull()
  })
})

describe('a specialist the addressing brought into the room', () => {
  afterEach(cleanup)

  it('says which one, beside the round that brought it in', async () => {
    renderConversation({
      id: 'r1',
      message: '@reader is this scene too long',
      addressed: ['reader'],
      brought: ['reader'],
      participants: [{ participantId: 'reader', result: { kind: 'response', outcome: 'commentary', claim: 'It runs long.' } }],
      outcome: 'settled',
    })

    await screen.findByText('It runs long.')

    expect(screen.getByText('ROOM CHANGED')).toBeTruthy()
    expect(screen.getByText('Reader Experience was addressed and is now in the room.')).toBeTruthy()
  })

  it('says nothing where addressing changed nothing', async () => {
    renderConversation(SETTLED_ROUND)

    await screen.findByText('It holds.')

    expect(screen.queryByText('ROOM CHANGED')).toBeNull()
  })
})

/** A settled round with one applicable suggestion, ready to apply. */
const ROUND_WITH_RECOMMENDATION: RoundRecord = {
  id: 'r1',
  addressed: [],
  brought: [],
  participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } }],
  outcome: 'settled',
}

describe('the applied change, shown on the response', () => {
  afterEach(cleanup)

  it('presents a bounded change collapsed to a computed count, disclosed on the author\'s action', async () => {
    const conversation: ConversationRecord = { id: 'c1', rounds: [ROUND_WITH_RECOMMENDATION] }
    const room: RoomAdapters = {
      ...roomHolding(conversation),
      applyRecommendation: () =>
        Promise.resolve({
          outcome: 'value',
          value: {
            outcome: 'applied',
            manuscript: 'the revised manuscript',
            change: {
              id: 'change1',
              roundId: 'r1',
              participantId: 'shape',
              content: { kind: 'passages', passages: [{ before: 'the old line', after: 'the new line' }] },
            },
          },
        }),
    }

    renderConversation(ROUND_WITH_RECOMMENDATION, { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))

    const toggle = await screen.findByRole('button', { name: 'APPLIED · 3 WORDS' })
    expect(screen.queryByText('the old line')).toBeNull()

    fireEvent.click(toggle)

    expect(await screen.findByText('the old line')).toBeTruthy()
    expect(screen.getByText('the new line')).toBeTruthy()
  })

  it('presents a whole-manuscript rewrite as the bare statement, with nothing to disclose', async () => {
    const conversation: ConversationRecord = { id: 'c1', rounds: [ROUND_WITH_RECOMMENDATION] }
    const room: RoomAdapters = {
      ...roomHolding(conversation),
      applyRecommendation: () =>
        Promise.resolve({
          outcome: 'value',
          value: {
            outcome: 'applied',
            manuscript: 'an entirely different piece',
            change: { id: 'change1', roundId: 'r1', participantId: 'shape', content: { kind: 'rewrittenWhole' } },
          },
        }),
    }

    renderConversation(ROUND_WITH_RECOMMENDATION, { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))

    await screen.findByText('APPLIED · REWRITTEN WHOLE')
    expect(screen.queryByRole('button', { name: /APPLIED/ })).toBeNull()
  })

  it('asks the room about the change as an ordinary message the author does not have to compose', async () => {
    const conversation: ConversationRecord = { id: 'c1', rounds: [ROUND_WITH_RECOMMENDATION] }
    const startRound = vi.fn(() => Promise.resolve<RequestResult<{ conversationId: string; roundId: string }>>({ outcome: 'value', value: { conversationId: 'c1', roundId: 'r2' } }))
    const room: RoomAdapters = {
      ...roomHolding(conversation),
      startRound,
      applyRecommendation: () =>
        Promise.resolve({
          outcome: 'value',
          value: {
            outcome: 'applied',
            manuscript: 'the revised manuscript',
            change: {
              id: 'change1',
              roundId: 'r1',
              participantId: 'shape',
              content: { kind: 'passages', passages: [{ before: 'the old line', after: 'the new line' }] },
            },
          },
        }),
    }

    renderConversation(ROUND_WITH_RECOMMENDATION, { room })

    fireEvent.click(await screen.findByRole('button', { name: 'apply' }))
    fireEvent.click(await screen.findByRole('button', { name: 'ask the room about this' }))

    await waitFor(() =>
      expect(startRound).toHaveBeenCalledWith(
        'the-lighthouse',
        'c1',
        { message: 'Take a look at the change I just made and tell me what you think.' },
        'First light.',
      ),
    )
  })
})

describe('replying to a response', () => {
  afterEach(cleanup)

  it('empty, addresses that participant in the main input and focuses it', async () => {
    renderConversation(SETTLED_ROUND)

    fireEvent.click(await screen.findByRole('button', { name: 'reply' }))

    const composer = await screen.findByLabelText('Message the room')
    await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe('@shape '))
    expect(document.activeElement).toBe(composer)
  })

  it('with text, sends it to that participant immediately rather than focusing the composer', async () => {
    const startRound = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; roundId: string }>>({ outcome: 'value', value: { conversationId: 'c1', roundId: 'r2' } }),
    )
    const room: RoomAdapters = { ...roomHolding({ id: 'c1', rounds: [SETTLED_ROUND] }), startRound }

    renderConversation(SETTLED_ROUND, { room })

    const field = await screen.findByLabelText('Reply, in your own words')
    fireEvent.change(field, { target: { value: 'say more about that' } })
    fireEvent.click(screen.getByRole('button', { name: 'reply' }))

    await waitFor(() =>
      expect(startRound).toHaveBeenCalledWith('the-lighthouse', 'c1', { target: 'shape', message: 'say more about that' }, 'First light.'),
    )
    expect((field as HTMLInputElement).value).toBe('')

    // The reply went straight to the room rather than into the main input.
    expect((screen.getByLabelText('Message the room') as HTMLTextAreaElement).value).toBe('')
  })
})

describe('asking for a concrete change', () => {
  afterEach(cleanup)

  it('is offered on a response that offered a reading without an action', async () => {
    renderConversation(SETTLED_ROUND)

    await screen.findByText('It holds.')

    expect(screen.getByRole('button', { name: 'ask for a concrete change' })).toBeTruthy()
  })

  it('is not offered on an applicable suggestion, which offers Apply instead', async () => {
    renderConversation(ROUND_WITH_RECOMMENDATION)

    await screen.findByRole('button', { name: 'apply' })

    expect(screen.queryByRole('button', { name: 'ask for a concrete change' })).toBeNull()
  })

  it('opens an ordinary round carrying no author message, naming the response it came from', async () => {
    const startRound = vi.fn(() =>
      Promise.resolve<RequestResult<{ conversationId: string; roundId: string }>>({ outcome: 'value', value: { conversationId: 'c1', roundId: 'r2' } }),
    )
    const room: RoomAdapters = { ...roomHolding({ id: 'c1', rounds: [SETTLED_ROUND] }), startRound }

    renderConversation(SETTLED_ROUND, { room })

    fireEvent.click(await screen.findByRole('button', { name: 'ask for a concrete change' }))

    await waitFor(() =>
      expect(startRound).toHaveBeenCalledWith(
        'the-lighthouse',
        'c1',
        { respondingTo: { roundId: 'r0', participantId: 'shape' }, clarification: undefined },
        'First light.',
      ),
    )
  })

  it('shows the naming at the foot of the conversation, in place of the author message a round like this never had', async () => {
    renderConversation({
      id: 'r1',
      addressed: ['shape'],
      brought: [],
      respondingTo: { roundId: 'r0', participantId: 'shape' },
      participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut the aside' } }],
      outcome: 'settled',
    })

    await screen.findByText('cut the aside')

    expect(screen.getByText('Shape was asked for a concrete change.')).toBeTruthy()
  })
})

describe('handle completion at the composer', () => {
  afterEach(cleanup)

  it('offers every handle the token prefix-matches, as the author types one', async () => {
    renderConversation(SETTLED_ROUND)

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: '@sh' } })

    expect(await screen.findByText('@shape')).toBeTruthy()
    expect(screen.queryByText('@reader')).toBeNull()
  })

  it('offers nothing for a sigil that does not begin the message or follow whitespace', async () => {
    renderConversation(SETTLED_ROUND)

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: 'mail@sh' } })

    expect(screen.queryByText('@shape')).toBeNull()
  })

  it('completes the token into the message, and closes the offer', async () => {
    renderConversation(SETTLED_ROUND)

    const composer = await screen.findByLabelText('Message the room')
    fireEvent.change(composer, { target: { value: '@sh' } })

    const suggestion = await screen.findByRole('option', { name: /@shape/ })
    fireEvent.click(suggestion)

    await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe('@shape '))
    expect(screen.queryByRole('option')).toBeNull()
  })
})
