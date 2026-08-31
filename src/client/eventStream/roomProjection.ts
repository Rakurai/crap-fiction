import type {
  ActionFinishedEvent,
  ActionKind,
  ConversationActivitySnapshot,
  ConversationFailureCode,
  ParticipantState,
  RoomActivitySnapshot,
  RoomEvent,
} from '../../shared/conversationEvents.js'
import type { ConversationEntryView } from '../../shared/conversationEntryViews.js'
import type { SurfaceId } from '../../shared/surfaces.js'

export type BusyAction = Readonly<{
  actionId: string
  kind: ActionKind
  conversationId: string
  sourceEntryId: string
  startedAt: number
  audience: readonly string[]
  applicationId: string | undefined
  participants: Readonly<Record<string, ParticipantState>>
}>

export type ScopeActivity =
  | Readonly<{ status: 'unknown' }>
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'busy'; action: BusyAction }>

export type StreamFailureReason = 'disconnected' | 'unreadable'

export type ConnectionStatus =
  | Readonly<{ status: 'absent' }>
  | Readonly<{ status: 'retrying' }>
  | Readonly<{ status: 'open' }>
  | Readonly<{ status: 'failed'; reason: StreamFailureReason }>

export type StatedFailure = Readonly<{ code: ConversationFailureCode; message: string }>

export type FinishedOutcome = ActionFinishedEvent['outcome']

export type RoomProjectionState = Readonly<{
  connection: ConnectionStatus
  awaitingSnapshot: boolean
  buffered: readonly RoomEvent[]
  scopes: Readonly<Record<SurfaceId, ScopeActivity>>
  failures: Readonly<Record<SurfaceId, readonly StatedFailure[]>>
  finished: Readonly<Record<SurfaceId, FinishedOutcome | null>>
}>

type SnapshotFrame = Readonly<{ type: 'activity.snapshot'; data: RoomActivitySnapshot }>
export type Frame = SnapshotFrame | RoomEvent

export type StreamEvent =
  | Readonly<{ type: 'connecting' }>
  | Readonly<{ type: 'opened' }>
  | Readonly<{ type: 'disconnected' }>
  | Readonly<{ type: 'unreadable' }>
  | Readonly<{ type: 'frame'; frame: Frame }>

export type RoomProjectionEffect =
  | Readonly<{ type: 'closeConnection' }>
  | Readonly<{ type: 'invalidatePieceDetail' }>
  | Readonly<{ type: 'appendEntry'; surface: SurfaceId; conversationId: string; entry: ConversationEntryView }>

type RoomProjectionTransition = Readonly<{ state: RoomProjectionState; effects: readonly RoomProjectionEffect[] }>

const INVALIDATE_PIECE_DETAIL: RoomProjectionEffect = { type: 'invalidatePieceDetail' }
const CLOSE_CONNECTION: RoomProjectionEffect = { type: 'closeConnection' }

function unknownScopes(): Readonly<Record<SurfaceId, ScopeActivity>> {
  return { draft: { status: 'unknown' }, storyContext: { status: 'unknown' }, authorContext: { status: 'unknown' } }
}

const NO_FAILURES: readonly StatedFailure[] = []

function unstatedFailures(): Readonly<Record<SurfaceId, readonly StatedFailure[]>> {
  return { draft: NO_FAILURES, storyContext: NO_FAILURES, authorContext: NO_FAILURES }
}

function unfinishedScopes(): Readonly<Record<SurfaceId, FinishedOutcome | null>> {
  return { draft: null, storyContext: null, authorContext: null }
}

function freshState(connection: ConnectionStatus): RoomProjectionState {
  return {
    connection,
    awaitingSnapshot: true,
    buffered: [],
    scopes: unknownScopes(),
    failures: unstatedFailures(),
    finished: unfinishedScopes(),
  }
}

export function initialRoomProjection(): RoomProjectionState {
  return freshState({ status: 'retrying' })
}

function reconnecting(state: RoomProjectionState, connection: ConnectionStatus): RoomProjectionState {
  return { ...freshState(connection), failures: state.failures, finished: state.finished }
}

function noEffects(state: RoomProjectionState): RoomProjectionTransition {
  return { state, effects: [] }
}

function withScope(state: RoomProjectionState, surface: SurfaceId, activity: ScopeActivity): RoomProjectionState {
  return { ...state, scopes: { ...state.scopes, [surface]: activity } }
}

function withStatedFailure(state: RoomProjectionState, surface: SurfaceId, failure: StatedFailure): RoomProjectionState {
  return { ...state, failures: { ...state.failures, [surface]: [...state.failures[surface], failure] } }
}

function withFinish(state: RoomProjectionState, surface: SurfaceId, outcome: FinishedOutcome): RoomProjectionState {
  return { ...state, finished: { ...state.finished, [surface]: outcome } }
}

function startingOver(state: RoomProjectionState, surface: SurfaceId): RoomProjectionState {
  return {
    ...state,
    failures: { ...state.failures, [surface]: NO_FAILURES },
    finished: { ...state.finished, [surface]: null },
  }
}

function busyActionFor(state: RoomProjectionState, surface: SurfaceId, actionId: string): BusyAction | undefined {
  const scope = state.scopes[surface]
  return scope.status === 'busy' && scope.action.actionId === actionId ? scope.action : undefined
}

function withoutParticipant(participants: Readonly<Record<string, ParticipantState>>, participantId: string): Readonly<Record<string, ParticipantState>> {
  const next: Record<string, ParticipantState> = { ...participants }
  delete next[participantId]
  return next
}

function toBusyAction(snapshot: ConversationActivitySnapshot): BusyAction {
  return {
    actionId: snapshot.actionId,
    kind: snapshot.kind,
    conversationId: snapshot.conversationId,
    sourceEntryId: snapshot.sourceEntryId,
    startedAt: snapshot.startedAt,
    audience: snapshot.kind === 'dispatch' ? snapshot.audience : [],
    applicationId: snapshot.kind === 'apply' ? snapshot.applicationId : undefined,
    participants: snapshot.kind === 'dispatch' ? snapshot.states : {},
  }
}

function scopeFromSnapshot(entry: ConversationActivitySnapshot | null): ScopeActivity {
  return entry === null ? { status: 'idle' } : { status: 'busy', action: toBusyAction(entry) }
}

function scopesFromSnapshot(snapshot: RoomActivitySnapshot): Readonly<Record<SurfaceId, ScopeActivity>> {
  return {
    draft: scopeFromSnapshot(snapshot.draft),
    storyContext: scopeFromSnapshot(snapshot.storyContext),
    authorContext: scopeFromSnapshot(snapshot.authorContext),
  }
}

function applyRoomEvent(state: RoomProjectionState, event: RoomEvent): RoomProjectionTransition {
  switch (event.type) {
    case 'action.started': {
      const d = event.data
      const action: BusyAction = {
        actionId: d.actionId,
        kind: d.kind,
        conversationId: d.conversationId,
        sourceEntryId: d.sourceEntryId,
        startedAt: d.startedAt,
        audience: d.kind === 'dispatch' ? d.audience : [],
        applicationId: undefined,
        participants: {},
      }
      return noEffects(withScope(startingOver(state, d.surface), d.surface, { status: 'busy', action }))
    }
    case 'apply.pending': {
      const d = event.data
      const current = busyActionFor(state, d.surface, d.actionId)
      if (current === undefined) return noEffects(state)
      return noEffects(withScope(state, d.surface, { status: 'busy', action: { ...current, applicationId: d.applicationId } }))
    }
    case 'participant.activity': {
      const d = event.data
      const current = busyActionFor(state, d.surface, d.actionId)
      if (current === undefined) return noEffects(state)
      const participants = { ...current.participants, [d.participantId]: { state: d.state, startedAt: d.startedAt } }
      return noEffects(withScope(state, d.surface, { status: 'busy', action: { ...current, participants } }))
    }
    case 'entry.appended': {
      const d = event.data
      const effects: RoomProjectionEffect[] = d.entry.kind === 'authorMessage' ? [INVALIDATE_PIECE_DETAIL] : []
      const current = busyActionFor(state, d.surface, d.actionId)
      if (current === undefined) return { state, effects }
      effects.push({ type: 'appendEntry', surface: d.surface, conversationId: current.conversationId, entry: d.entry })
      if (d.entry.kind !== 'participantResponse' && d.entry.kind !== 'participantNoComment' && d.entry.kind !== 'participantFailure') {
        return { state, effects }
      }
      const participants = withoutParticipant(current.participants, d.entry.participantId)
      return { state: withScope(state, d.surface, { status: 'busy', action: { ...current, participants } }), effects }
    }
    case 'action.finished': {
      const d = event.data
      const current = busyActionFor(state, d.surface, d.actionId)
      if (current === undefined) return noEffects(state)
      return noEffects(withScope(withFinish(state, d.surface, d.outcome), d.surface, { status: 'idle' }))
    }
    case 'error': {
      const d = event.data
      return noEffects(withStatedFailure(state, d.surface, { code: d.code, message: d.message }))
    }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

function drainBuffer(state: RoomProjectionState, frames: readonly RoomEvent[]): RoomProjectionTransition {
  let current = state
  const effects: RoomProjectionEffect[] = []
  for (const frame of frames) {
    const result = applyRoomEvent(current, frame)
    current = result.state
    effects.push(...result.effects)
  }
  return { state: current, effects }
}

function applyFrame(state: RoomProjectionState, frame: Frame): RoomProjectionTransition {
  if (frame.type === 'activity.snapshot') {
    const snapshotState: RoomProjectionState = {
      ...state,
      connection: { status: 'open' },
      awaitingSnapshot: false,
      buffered: [],
      scopes: scopesFromSnapshot(frame.data),
    }
    return drainBuffer(snapshotState, state.buffered)
  }
  if (state.awaitingSnapshot) return noEffects({ ...state, buffered: [...state.buffered, frame] })
  return applyRoomEvent(state, frame)
}

export function transitionRoomProjection(state: RoomProjectionState, event: StreamEvent): RoomProjectionTransition {
  switch (event.type) {
    case 'connecting':
      return noEffects(reconnecting(state, { status: 'retrying' }))
    case 'opened':
      return noEffects(state)
    case 'disconnected':
      return noEffects(reconnecting(state, { status: 'failed', reason: 'disconnected' }))
    case 'unreadable':
      return { state: reconnecting(state, { status: 'failed', reason: 'unreadable' }), effects: [CLOSE_CONNECTION] }
    case 'frame':
      return applyFrame(state, event.frame)
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
