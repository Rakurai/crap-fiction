import { describe, expect, it } from 'vitest'
import { EMPTY_PROJECTION, initialProjection, projectEvent, withDispatchInFlight, type RoomEvent } from '../../src/client/entryProjection.js'
import type { ConversationEntryView } from '../../src/shared/conversationEntryViews.js'
import type { DispatchActivitySnapshot } from '../../src/shared/conversationEvents.js'

const STARTED_AT = 1_700_000_000_000

function authorMessage(id: string, text = 'a message'): ConversationEntryView {
  return { id, kind: 'authorMessage', text, audience: ['shape'], brought: [] }
}

function response(id: string, participantId: string, causeId: string): ConversationEntryView {
  return { id, kind: 'participantResponse', participantId, causeId, outcome: 'commentary', claim: 'x' }
}

function started(actionId: string, audience: readonly string[] = ['shape', 'compression']): RoomEvent {
  return { type: 'action.started', data: { actionId, conversationId: 'c1', kind: 'dispatch', sourceEntryId: 'e0', startedAt: STARTED_AT, audience } }
}

function activity(participantId: string, state: 'preparing' | 'working', actionId = 'a1'): RoomEvent {
  return { type: 'participant.activity', data: { actionId, participantId, state } }
}

function appended(entry: ConversationEntryView, actionId = 'a1'): RoomEvent {
  return { type: 'entry.appended', data: { actionId, entry } }
}

function finished(actionId: string, outcome: 'settled' | 'abandoned' | 'failed'): RoomEvent {
  return { type: 'action.finished', data: { actionId, outcome } }
}

describe('projectEvent', () => {
  it('opens the activity snapshot on a dispatch action.started, with no states yet', () => {
    const projection = projectEvent(EMPTY_PROJECTION, started('a1'))

    expect(projection.activity).toEqual({
      actionId: 'a1',
      conversationId: 'c1',
      kind: 'dispatch',
      sourceEntryId: 'e0',
      audience: ['shape', 'compression'],
      states: {},
      startedAt: STARTED_AT,
    })
  })

  it('ignores an apply action.started, since apply activity is not part of this projection', () => {
    const projection = projectEvent(EMPTY_PROJECTION, {
      type: 'action.started',
      data: { actionId: 'a1', conversationId: 'c1', kind: 'apply', sourceEntryId: 'e0', startedAt: STARTED_AT },
    })

    expect(projection.activity).toBeUndefined()
  })

  it('tracks a participant moving through preparing and working', () => {
    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))
    projection = projectEvent(projection, activity('shape', 'preparing'))
    expect(projection.activity?.states.shape).toBe('preparing')

    projection = projectEvent(projection, activity('shape', 'working'))
    expect(projection.activity?.states.shape).toBe('working')
  })

  it('appends a landed entry and clears that participant from the active states', () => {
    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))
    projection = projectEvent(projection, activity('shape', 'working'))
    projection = projectEvent(projection, appended(response('e1', 'shape', 'e0')))

    expect(projection.entries.map((entry) => entry.id)).toEqual(['e1'])
    expect(projection.activity?.states.shape).toBeUndefined()
  })

  it('appends an entry with no participant untouched by the states map', () => {
    const projection = projectEvent(EMPTY_PROJECTION, appended(authorMessage('e1')))

    expect(projection.entries).toEqual([authorMessage('e1')])
  })

  it('a response delivered twice appears once', () => {
    let projection = projectEvent(EMPTY_PROJECTION, appended(response('e1', 'shape', 'e0')))
    projection = projectEvent(projection, appended(response('e1', 'shape', 'e0')))

    expect(projection.entries).toHaveLength(1)
  })

  it('clears the activity once the matching action finishes', () => {
    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))
    projection = projectEvent(projection, finished('a1', 'settled'))

    expect(projection.activity).toBeUndefined()
  })

  it('ignores a finished event for an action that is not the current one', () => {
    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))
    projection = projectEvent(projection, finished('stale-action', 'abandoned'))

    expect(projection.activity?.actionId).toBe('a1')
  })

  it('ignores participant activity for an action that is not the current one', () => {
    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))
    projection = projectEvent(projection, activity('shape', 'working', 'a-different-action'))

    expect(projection.activity?.states.shape).toBeUndefined()
  })
})

describe('initialProjection', () => {
  it("projects a conversation file's entries as-is, with no activity, so a reload shows them with no new event", () => {
    const entries = [authorMessage('e1'), response('e2', 'shape', 'e1')]

    expect(initialProjection(entries)).toEqual({ entries, activity: undefined })
  })
})

describe('withDispatchInFlight', () => {
  it('seeds the activity when the piece reports a dispatch already in flight on reload', () => {
    const snapshot: DispatchActivitySnapshot = {
      actionId: 'a1',
      conversationId: 'c1',
      kind: 'dispatch',
      sourceEntryId: 'e0',
      audience: ['shape'],
      states: { shape: 'working' },
      startedAt: STARTED_AT,
    }

    expect(withDispatchInFlight(EMPTY_PROJECTION, snapshot)).toEqual({ entries: [], activity: snapshot })
  })
})
