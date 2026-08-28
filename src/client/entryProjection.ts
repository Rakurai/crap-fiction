import type { ConversationEntryView } from '../shared/conversationEntryViews.js'
import type {
  ActionFinishedEvent,
  ActionStartedEvent,
  ApplyPendingEvent,
  ConversationErrorEvent,
  DispatchActivitySnapshot,
  EntryAppendedEvent,
  ParticipantActivityEvent,
} from '../shared/conversationEvents.js'

export type RoomEvent =
  | Readonly<{ type: 'action.started'; data: ActionStartedEvent }>
  | Readonly<{ type: 'apply.pending'; data: ApplyPendingEvent }>
  | Readonly<{ type: 'participant.activity'; data: ParticipantActivityEvent }>
  | Readonly<{ type: 'entry.appended'; data: EntryAppendedEvent }>
  | Readonly<{ type: 'action.finished'; data: ActionFinishedEvent }>
  | Readonly<{ type: 'error'; data: ConversationErrorEvent }>

export type ConversationProjection = Readonly<{
  entries: readonly ConversationEntryView[]
  activity: DispatchActivitySnapshot | undefined
  freshApplicationIds: ReadonlySet<string>
}>

export const EMPTY_PROJECTION: ConversationProjection = { entries: [], activity: undefined, freshApplicationIds: new Set() }

export function isParticipantOutcome(
  entry: ConversationEntryView,
): entry is Extract<ConversationEntryView, { kind: 'participantResponse' | 'participantNoComment' | 'participantFailure' }> {
  return entry.kind === 'participantResponse' || entry.kind === 'participantNoComment' || entry.kind === 'participantFailure'
}

export function appendEntry(projection: ConversationProjection, entry: ConversationEntryView): ConversationProjection {
  if (projection.entries.some((existing) => existing.id === entry.id)) return projection
  return { ...projection, entries: [...projection.entries, entry] }
}

export function applyDispatchEvent(activity: DispatchActivitySnapshot | undefined, event: RoomEvent): DispatchActivitySnapshot | undefined {
  switch (event.type) {
    case 'action.started': {
      if (event.data.kind !== 'dispatch') return activity
      return {
        actionId: event.data.actionId,
        conversationId: event.data.conversationId,
        kind: 'dispatch',
        sourceEntryId: event.data.sourceEntryId,
        audience: event.data.audience,
        states: {},
        startedAt: event.data.startedAt,
      }
    }
    case 'participant.activity': {
      if (activity === undefined || activity.actionId !== event.data.actionId) return activity
      const { participantId, state, startedAt } = event.data
      return { ...activity, states: { ...activity.states, [participantId]: { state, startedAt } } }
    }
    case 'entry.appended': {
      if (activity === undefined || activity.actionId !== event.data.actionId) return activity
      const { entry } = event.data
      if (!isParticipantOutcome(entry)) return activity
      const states = { ...activity.states }
      delete states[entry.participantId]
      return { ...activity, states }
    }
    case 'action.finished':
      if (activity?.actionId !== event.data.actionId) return activity
      return undefined
    case 'apply.pending':
    case 'error':
      return activity
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

export function projectEvent(projection: ConversationProjection, event: RoomEvent): ConversationProjection {
  switch (event.type) {
    case 'entry.appended': {
      const next = appendEntry(projection, event.data.entry)
      const { entry } = event.data
      const freshApplicationIds = entry.kind === 'application' ? new Set(next.freshApplicationIds).add(entry.id) : next.freshApplicationIds
      const activity = applyDispatchEvent(next.activity, event)
      return { ...next, activity, freshApplicationIds }
    }
    case 'apply.pending':
      return projection
    case 'action.started':
    case 'participant.activity':
    case 'action.finished': {
      const activity = applyDispatchEvent(projection.activity, event)
      return activity === projection.activity ? projection : { ...projection, activity }
    }
    case 'error':
      return projection
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
