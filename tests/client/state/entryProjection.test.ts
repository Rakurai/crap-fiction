import { describe, expect, it } from 'vitest'
import { EMPTY_PROJECTION, projectEvent, type RoomEvent } from '../../../src/client/entryProjection.js'
import type { ConversationEntryView } from '../../../src/shared/conversationEntryViews.js'

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
  it('opens the activity snapshot on a dispatch, with no states yet, then tracks each participant through preparing and working', () => {
    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))

    expect(projection.activity).toEqual({
      actionId: 'a1',
      conversationId: 'c1',
      kind: 'dispatch',
      sourceEntryId: 'e0',
      audience: ['shape', 'compression'],
      states: {},
      startedAt: STARTED_AT,
    })

    projection = projectEvent(projection, activity('shape', 'preparing'))
    expect(projection.activity?.states.shape).toBe('preparing')

    projection = projectEvent(projection, activity('shape', 'working'))
    expect(projection.activity?.states.shape).toBe('working')
  })

  it('appends a landed entry, clearing the participant that produced it from the active states and leaving one with none alone', () => {
    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))
    projection = projectEvent(projection, activity('shape', 'working'))
    projection = projectEvent(projection, appended(response('e1', 'shape', 'e0')))

    expect(projection.entries.map((entry) => entry.id)).toEqual(['e1'])
    expect(projection.activity?.states.shape).toBeUndefined()

    projection = projectEvent(projection, appended(authorMessage('e2')))
    expect(projection.entries[1]).toEqual(authorMessage('e2'))
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

  /**
   * One claim over every event the projection sees: an event belonging to something other
   * than the dispatch it is currently tracking cannot move it.
   */
  it('ignores an event that is not this dispatch — an apply, or an activity or a finish naming another action', () => {
    const apply = projectEvent(EMPTY_PROJECTION, {
      type: 'action.started',
      data: { actionId: 'a1', conversationId: 'c1', kind: 'apply', sourceEntryId: 'e0', startedAt: STARTED_AT },
    })
    expect(apply.activity).toBeUndefined()

    let projection = projectEvent(EMPTY_PROJECTION, started('a1'))

    projection = projectEvent(projection, activity('shape', 'working', 'a-different-action'))
    expect(projection.activity?.states.shape).toBeUndefined()

    projection = projectEvent(projection, finished('stale-action', 'abandoned'))
    expect(projection.activity?.actionId).toBe('a1')
  })
})
