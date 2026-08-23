import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Conversation as ConversationRecord, RoundRecord } from '../../../src/shared/conversationViews.js'
import { Conversation } from '../../../src/client/Conversation.js'
import type { RoomAdapters } from '../../../src/client/useConversation.js'

const NAMES: Record<string, string> = { shape: 'Shape', reader: 'Reader Experience', editor: 'Story Editor' }

/**
 * The room, stood still: this surface is being read, not driven, so the stream
 * yields nothing and the conversation is whatever the fixture recorded. Sending a
 * message is exercised where it is decided — `useConversation` and `Room`.
 */
function roomHolding(conversation: ConversationRecord): RoomAdapters {
  return {
    subscribeToRoom: () => () => {},
    createConversation: () => Promise.resolve({ outcome: 'value', value: { id: conversation.id } }),
    fetchConversation: () => Promise.resolve({ outcome: 'value', value: conversation }),
    startRound: () => Promise.resolve({ outcome: 'value', value: { conversationId: conversation.id, roundId: 'r1' } }),
  }
}

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
        states: { shape: 'working' },
        settled: [],
        openedAt: OPENED_AT,
      },
    })

    const input = await screen.findByLabelText('Message the room')

    // Sending is what waits, and the button is where that is said.
    expect((input as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
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
