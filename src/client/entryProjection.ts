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
}>

export const EMPTY_PROJECTION: ConversationProjection = { entries: [], activity: undefined }

export function isParticipantOutcome(
  entry: ConversationEntryView,
): entry is Extract<ConversationEntryView, { kind: 'participantResponse' | 'participantNoComment' | 'participantFailure' }> {
  return entry.kind === 'participantResponse' || entry.kind === 'participantNoComment' || entry.kind === 'participantFailure'
}

export function appendEntry(projection: ConversationProjection, entry: ConversationEntryView): ConversationProjection {
  if (projection.entries.some((existing) => existing.id === entry.id)) return projection
  return { ...projection, entries: [...projection.entries, entry] }
}

export function projectEvent(projection: ConversationProjection, event: RoomEvent): ConversationProjection {
  switch (event.type) {
    case 'action.started': {
      if (event.data.kind !== 'dispatch') return projection
      return {
        ...projection,
        activity: {
          actionId: event.data.actionId,
          conversationId: event.data.conversationId,
          kind: 'dispatch',
          sourceEntryId: event.data.sourceEntryId,
          audience: event.data.audience,
          states: {},
          startedAt: event.data.startedAt,
        },
      }
    }
    case 'participant.activity': {
      const activity = projection.activity
      if (activity === undefined || activity.actionId !== event.data.actionId) return projection
      const { participantId, state, startedAt } = event.data
      return { ...projection, activity: { ...activity, states: { ...activity.states, [participantId]: { state, startedAt } } } }
    }
    case 'apply.pending':
      return projection
    case 'entry.appended': {
      const next = appendEntry(projection, event.data.entry)
      const activity = next.activity
      const { entry } = event.data
      if (activity !== undefined && activity.actionId === event.data.actionId && isParticipantOutcome(entry)) {
        const states = { ...activity.states }
        delete states[entry.participantId]
        return { ...next, activity: { ...activity, states } }
      }
      return next
    }
    case 'action.finished': {
      if (projection.activity?.actionId !== event.data.actionId) return projection
      return { ...projection, activity: undefined }
    }
    case 'error': {
      return projection
    }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
