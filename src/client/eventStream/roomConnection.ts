import type { QueryClient } from '@tanstack/react-query'
import { roomActivitySnapshotSchema, roomEventSchema } from '../../shared/conversationEvents.js'
import { pieceDetailKey } from '../servedFacts/resources.js'
import { createSubscribableValue } from '../pieceSession/subscribableValue.js'
import { initialRoomProjection, transitionRoomProjection, type Frame, type RoomProjectionState, type StreamEvent } from './roomProjection.js'

const NAMED_EVENTS = ['activity.snapshot', 'action.started', 'apply.pending', 'participant.activity', 'entry.appended', 'action.finished'] as const

function parseFrame(name: string, dataText: string): Frame | undefined {
  let data: unknown
  try {
    data = JSON.parse(dataText)
  } catch {
    return undefined
  }
  if (name === 'activity.snapshot') {
    const parsed = roomActivitySnapshotSchema.safeParse(data)
    return parsed.success ? { type: 'activity.snapshot', data: parsed.data } : undefined
  }
  const parsed = roomEventSchema.safeParse({ type: name, data })
  return parsed.success ? parsed.data : undefined
}

export type RoomConnection = Readonly<{
  getState: () => RoomProjectionState
  subscribe: (onChange: () => void) => () => void
  dispose: () => void
}>

export function connectToRoom(pieceId: string, queryClient: QueryClient): RoomConnection {
  const value = createSubscribableValue(initialRoomProjection())
  const source = new EventSource(`/pieces/${pieceId}/events`)

  function apply(event: StreamEvent): void {
    const { state, effects } = transitionRoomProjection(value.get(), event)
    value.set(state)
    for (const effect of effects) {
      if (effect.type === 'closeConnection') source.close()
      else void queryClient.invalidateQueries({ queryKey: pieceDetailKey(pieceId) })
    }
  }

  function handleFrame(name: string, dataText: string): void {
    const frame = parseFrame(name, dataText)
    apply(frame === undefined ? { type: 'unreadable' } : { type: 'frame', frame })
  }

  source.addEventListener('open', () => apply({ type: 'opened' }))

  // The server names a domain frame "error" for a room failure, and `EventSource` fires its own
  // connection-error `Event` under the same name: a `MessageEvent` (carrying `data`) is the
  // former, a plain `Event` the latter, which is the only way to tell them apart on this listener.
  source.addEventListener('error', (event) => {
    if (event instanceof MessageEvent) {
      handleFrame('error', event.data)
      return
    }
    apply({ type: source.readyState === EventSource.CLOSED ? 'disconnected' : 'connecting' })
  })

  for (const name of NAMED_EVENTS) {
    source.addEventListener(name, (event) => {
      if (event instanceof MessageEvent) handleFrame(name, event.data)
    })
  }

  return {
    getState: value.get,
    subscribe: value.subscribe,
    dispose: () => source.close(),
  }
}
