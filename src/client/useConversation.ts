import { useEffect, useRef, useState } from 'react'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import type { createConversation as createConversationFn, fetchConversation as fetchConversationFn, startRound as startRoundFn, subscribeToRoom as subscribeToRoomFn } from './roomClient.js'
import { EMPTY_PROJECTION, initialProjection, projectRoundEvent, withRoundInFlight, type ConversationProjection } from './roundProjection.js'

export type ConversationViewModel = Readonly<{
  projection: ConversationProjection
  busy: boolean
  error: string | undefined
  sendMessage: (message: string) => void
}>

/** The room's adapters, reached by whoever composes this hook rather than imported here. */
export type RoomAdapters = Readonly<{
  createConversation: typeof createConversationFn
  fetchConversation: typeof fetchConversationFn
  startRound: typeof startRoundFn
  subscribeToRoom: typeof subscribeToRoomFn
}>

/**
 * CODING_STANDARDS "Client": depth lives here rather than in the surface
 * that renders it. Owns the round's whole lifecycle from the author's side —
 * minting a conversation on the first message, starting a round, refusing a
 * second one while busy, and projecting the room's own events (never
 * inventing a state the server did not report).
 *
 * SPEC "Write semantics": starting a round flushes the pending draft write
 * without waiting on it, and the current text travels in the request either
 * way — `flushDraft` and `getDraft` are the caller's autosave controller and
 * its current text, called at the moment the author sends a message.
 */
export function useConversation(
  pieceId: string,
  initialConversationId: string | null,
  initialRoundInFlight: RoundSnapshot | null,
  flushDraft: () => void,
  getDraft: () => string,
  room: RoomAdapters,
): ConversationViewModel {
  const { createConversation, fetchConversation, startRound, subscribeToRoom } = room
  const [projection, setProjection] = useState<ConversationProjection>(() =>
    initialRoundInFlight === null ? EMPTY_PROJECTION : withRoundInFlight(EMPTY_PROJECTION, initialRoundInFlight),
  )
  const [busy, setBusy] = useState(initialRoundInFlight !== null)
  const [error, setError] = useState<string | undefined>(undefined)
  const conversationIdRef = useRef<string | null>(initialConversationId)

  useEffect(() => {
    let active = true

    if (initialConversationId !== null) {
      fetchConversation(pieceId, initialConversationId)
        .then((conversation) => {
          if (!active) return
          setProjection((prev) => ({ rounds: [...initialProjection(conversation.rounds).rounds, ...prev.rounds] }))
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'failed to load the conversation')
        })
    }

    const unsubscribe = subscribeToRoom(pieceId, (event) => {
      if (!active) return
      if (event.type === 'error') {
        setError(event.data.message)
        return
      }
      if (event.type === 'round.opened') {
        conversationIdRef.current = event.data.conversationId
        setBusy(true)
      }
      if (event.type === 'round.closed') setBusy(false)
      setProjection((prev) => projectRoundEvent(prev, event))
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [pieceId, initialConversationId])

  function sendMessage(message: string): void {
    if (busy) return
    flushDraft()
    setError(undefined)
    setBusy(true)

    async function run(): Promise<void> {
      let conversationId = conversationIdRef.current
      if (conversationId === null) {
        const created = await createConversation(pieceId)
        if (!created.ok) {
          setError(created.message)
          setBusy(false)
          return
        }
        conversationId = created.id
        conversationIdRef.current = created.id
      }

      const result = await startRound(pieceId, conversationId, message, getDraft())
      if (!result.ok) {
        setError(result.message)
        setBusy(false)
      }
    }

    void run()
  }

  return { projection, busy, error, sendMessage }
}
