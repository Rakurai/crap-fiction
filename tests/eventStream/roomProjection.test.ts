import { describe, expect, it } from 'vitest'
import type { RoomEvent } from '../../src/shared/conversationEvents.js'
import {
  initialRoomProjection,
  transitionRoomProjection,
  type RoomProjectionEffect,
  type RoomProjectionState,
  type StreamEvent,
} from '../../src/client/eventStream/roomProjection.js'

const DRAFT_ACTION_ID = 'action-draft-1'
const DRAFT_CONVERSATION_ID = 'conversation-draft-1'
const DRAFT_SOURCE_ENTRY_ID = 'entry-source-1'
const STARTED_AT = 1_700_000_000_000

function apply(state: RoomProjectionState, events: readonly StreamEvent[]): RoomProjectionState {
  return events.reduce((current, event) => transitionRoomProjection(current, event).state, state)
}

function effectsOf(state: RoomProjectionState, event: StreamEvent): readonly RoomProjectionEffect[] {
  return transitionRoomProjection(state, event).effects
}

function frame(event: RoomEvent): StreamEvent {
  return { type: 'frame', frame: event }
}

const draftDispatchStarted: RoomEvent = {
  type: 'action.started',
  data: {
    kind: 'dispatch',
    actionId: DRAFT_ACTION_ID,
    conversationId: DRAFT_CONVERSATION_ID,
    sourceEntryId: DRAFT_SOURCE_ENTRY_ID,
    startedAt: STARTED_AT,
    surface: 'draft',
    audience: ['ripley', 'story-editor'],
  },
}

function participantActivity(participantId: string, state: 'called' | 'preparing' | 'working', startedAt = STARTED_AT): RoomEvent {
  return {
    type: 'participant.activity',
    data: { actionId: DRAFT_ACTION_ID, participantId, state, startedAt, surface: 'draft' },
  }
}

function participantResponseEntry(participantId: string): RoomEvent {
  return {
    type: 'entry.appended',
    data: {
      actionId: DRAFT_ACTION_ID,
      surface: 'draft',
      entry: { id: `${participantId}-response`, kind: 'participantResponse', participantId, causeId: DRAFT_SOURCE_ENTRY_ID, outcome: 'commentary', claim: 'a claim' },
    },
  }
}

function authorMessageEntry(surface: 'draft' | 'storyContext' | 'authorContext' = 'draft'): RoomEvent {
  return {
    type: 'entry.appended',
    data: {
      actionId: DRAFT_ACTION_ID,
      surface,
      entry: { id: 'author-1', kind: 'authorMessage', text: 'hello room', audience: ['ripley'], brought: [] },
    },
  }
}

const draftFinished: RoomEvent = { type: 'action.finished', data: { actionId: DRAFT_ACTION_ID, surface: 'draft', outcome: 'settled' } }

const EMPTY_SNAPSHOT: StreamEvent = {
  type: 'frame',
  frame: { type: 'activity.snapshot', data: { draft: null, storyContext: null, authorContext: null } },
}

function connected(): RoomProjectionState {
  return apply(initialRoomProjection(), [{ type: 'opened' }, EMPTY_SNAPSHOT])
}

describe('before the first snapshot', () => {
  it('holds every scope as unknown rather than idle', () => {
    const state = initialRoomProjection()
    expect(state.scopes.draft).toEqual({ status: 'unknown' })
    expect(state.scopes.storyContext).toEqual({ status: 'unknown' })
    expect(state.scopes.authorContext).toEqual({ status: 'unknown' })
  })

  it('buffers a frame that arrives before the snapshot instead of acting on it', () => {
    const held = apply(initialRoomProjection(), [frame(draftDispatchStarted)])
    expect(held.scopes.draft).toEqual({ status: 'unknown' })
  })

  it('applies buffered frames, in order, the moment the snapshot arrives', () => {
    const withBufferedFrames = apply(initialRoomProjection(), [frame(draftDispatchStarted), frame(participantActivity('ripley', 'working'))])

    const snapshot: StreamEvent = {
      type: 'frame',
      frame: { type: 'activity.snapshot', data: { draft: null, storyContext: null, authorContext: null } },
    }
    const settled = transitionRoomProjection(withBufferedFrames, snapshot).state

    expect(settled.scopes.draft).toMatchObject({
      status: 'busy',
      action: { actionId: DRAFT_ACTION_ID, participants: { ripley: { state: 'working', startedAt: STARTED_AT } } },
    })
  })
})

describe('the snapshot establishes the baseline', () => {
  it('holds each of the three room scopes independently', () => {
    const snapshotted = apply(initialRoomProjection(), [
      {
        type: 'frame',
        frame: {
          type: 'activity.snapshot',
          data: {
            draft: {
              kind: 'dispatch',
              actionId: DRAFT_ACTION_ID,
              conversationId: DRAFT_CONVERSATION_ID,
              sourceEntryId: DRAFT_SOURCE_ENTRY_ID,
              startedAt: STARTED_AT,
              audience: ['ripley'],
              states: {},
            },
            storyContext: null,
            authorContext: null,
          },
        },
      },
    ])

    expect(snapshotted.scopes.draft.status).toBe('busy')
    expect(snapshotted.scopes.storyContext).toEqual({ status: 'idle' })
    expect(snapshotted.scopes.authorContext).toEqual({ status: 'idle' })
  })

  it('carries the server-stated start moment verbatim, not a client-side clock reading', () => {
    const snapshotted = apply(initialRoomProjection(), [
      {
        type: 'frame',
        frame: {
          type: 'activity.snapshot',
          data: {
            draft: {
              kind: 'dispatch',
              actionId: DRAFT_ACTION_ID,
              conversationId: DRAFT_CONVERSATION_ID,
              sourceEntryId: DRAFT_SOURCE_ENTRY_ID,
              startedAt: STARTED_AT,
              audience: [],
              states: {},
            },
            storyContext: null,
            authorContext: null,
          },
        },
      },
    ])

    expect(snapshotted.scopes.draft).toMatchObject({ action: { startedAt: STARTED_AT } })
  })
})

describe('activity is held per scope', () => {
  it('leaves another scope idle while one dispatch runs on the draft', () => {
    const busy = apply(connected(), [frame(draftDispatchStarted)])
    expect(busy.scopes.draft.status).toBe('busy')
    expect(busy.scopes.storyContext).toEqual({ status: 'idle' })
    expect(busy.scopes.authorContext).toEqual({ status: 'idle' })
  })

  it('records only the participants the room has actually reported progress for', () => {
    const busy = apply(connected(), [frame(draftDispatchStarted), frame(participantActivity('ripley', 'working'))])
    expect(busy.scopes.draft).toMatchObject({ action: { participants: { ripley: { state: 'working' } } } })
    expect(Object.keys((busy.scopes.draft as { action: { participants: object } }).action.participants)).toEqual(['ripley'])
  })

  it('clears a participant the instant its entry lands, never leaving an entry-less place for it', () => {
    const afterEntry = apply(connected(), [
      frame(draftDispatchStarted),
      frame(participantActivity('ripley', 'working')),
      frame(participantResponseEntry('ripley')),
    ])
    expect((afterEntry.scopes.draft as { action: { participants: object } }).action.participants).toEqual({})
  })

  it('returns the scope to idle once the action finishes', () => {
    const idleAgain = apply(connected(), [frame(draftDispatchStarted), frame(draftFinished)])
    expect(idleAgain.scopes.draft).toEqual({ status: 'idle' })
  })

  it('discards a finish naming an action that is no longer the scope\'s current one', () => {
    const state = apply(connected(), [frame(draftDispatchStarted)])
    const stale: RoomEvent = { type: 'action.finished', data: { actionId: 'a-stale-id', surface: 'draft', outcome: 'settled' } }
    const unaffected = apply(state, [frame(stale)])
    expect(unaffected.scopes.draft.status).toBe('busy')
  })

  it('discards a pending-apply identity naming an action that is no longer current', () => {
    const state = apply(connected(), [frame(draftDispatchStarted)])
    const stale: RoomEvent = { type: 'apply.pending', data: { actionId: 'a-stale-id', conversationId: DRAFT_CONVERSATION_ID, applicationId: 'app-1', sourceEntryId: DRAFT_SOURCE_ENTRY_ID, surface: 'draft' } }
    const unaffected = apply(state, [frame(stale)])
    expect(unaffected.scopes.draft).toMatchObject({ action: { applicationId: undefined } })
  })
})

describe('an appended author entry', () => {
  it('is notice to refresh the conversation index, regardless of which scope named it', () => {
    const effects = effectsOf(connected(), frame(authorMessageEntry('storyContext')))
    expect(effects).toEqual([{ type: 'invalidatePieceDetail' }])
  })

  it('produces the same effect whether the frame is delivered once or twice', () => {
    const once = effectsOf(connected(), frame(authorMessageEntry()))
    const stateAfterOnce = apply(connected(), [frame(authorMessageEntry())])
    const twice = effectsOf(stateAfterOnce, frame(authorMessageEntry()))
    expect(twice).toEqual(once)
  })
})

describe('a dropped connection', () => {
  it('holds every scope without stating a failure while the browser is still retrying', () => {
    const interrupted = apply(connected(), [{ type: 'connecting' }])
    expect(interrupted.connection).toEqual({ status: 'retrying' })
    expect(interrupted.scopes.draft).toEqual({ status: 'unknown' })
  })

  it('restores from the fresh snapshot a reconnection delivers', () => {
    const interrupted = apply(connected(), [{ type: 'connecting' }])
    const restored = apply(interrupted, [{ type: 'opened' }, EMPTY_SNAPSHOT])
    expect(restored.connection).toEqual({ status: 'open' })
    expect(restored.scopes.draft).toEqual({ status: 'idle' })
  })

  it('states a failure, distinct from a busy scope, once the connection stops retrying', () => {
    const disconnected = apply(connected(), [{ type: 'disconnected' }])
    expect(disconnected.connection).toEqual({ status: 'failed', reason: 'disconnected' })
    expect(disconnected.scopes.draft).toEqual({ status: 'unknown' })
  })

  it('closes the connection and states a distinct failure for a frame that cannot be interpreted', () => {
    const { state, effects } = transitionRoomProjection(connected(), { type: 'unreadable' })
    expect(state.connection).toEqual({ status: 'failed', reason: 'unreadable' })
    expect(effects).toEqual([{ type: 'closeConnection' }])
  })
})

describe('reading the piece mid-dispatch projects the same as watching it open from the start', () => {
  it('reaches an equal projection either way', () => {
    const fromTheStart = apply(connected(), [
      frame(draftDispatchStarted),
      frame(participantActivity('ripley', 'called')),
      frame(participantActivity('ripley', 'working')),
    ])

    const midDispatch = apply(initialRoomProjection(), [
      { type: 'opened' },
      {
        type: 'frame',
        frame: {
          type: 'activity.snapshot',
          data: {
            draft: {
              kind: 'dispatch',
              actionId: DRAFT_ACTION_ID,
              conversationId: DRAFT_CONVERSATION_ID,
              sourceEntryId: DRAFT_SOURCE_ENTRY_ID,
              startedAt: STARTED_AT,
              audience: ['ripley', 'story-editor'],
              states: { ripley: { state: 'working', startedAt: STARTED_AT } },
            },
            storyContext: null,
            authorContext: null,
          },
        },
      },
    ])

    expect(midDispatch.scopes.draft).toEqual(fromTheStart.scopes.draft)
  })
})
