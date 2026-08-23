import { useEffect, useRef, useState } from 'react'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import type {
  abandonOperation as abandonOperationFn,
  applyRecommendation as applyRecommendationFn,
  createConversation as createConversationFn,
  fetchConversation as fetchConversationFn,
  startRound as startRoundFn,
  subscribeToRoom as subscribeToRoomFn,
} from './roomClient.js'
import { failureMessage } from './request.js'
import { EMPTY_PROJECTION, initialProjection, projectRoundEvent, withRoundInFlight, type ConversationProjection } from './roundProjection.js'

/**
 * Said when sending broke here rather than at the studio, which is the one
 * failure the studio cannot describe because it never heard the request.
 */
const UNSENT = 'the message was not sent'

export type ConversationViewModel = Readonly<{
  projection: ConversationProjection
  busy: boolean
  error: string | undefined
  sendMessage: (message: string) => void
  abandon: () => void
  /**
   * The conversation an author action addresses right now, once one exists —
   * `null` until the first round mints it. Applying a recommendation needs
   * this rather than the id the piece opened with: a conversation minted by
   * this hook's own first round is a fact this hook holds and the piece
   * was never told.
   */
  conversationId: string | null
}>

/** The room's adapters, reached by whoever composes this hook rather than imported here. */
export type RoomAdapters = Readonly<{
  createConversation: typeof createConversationFn
  fetchConversation: typeof fetchConversationFn
  startRound: typeof startRoundFn
  subscribeToRoom: typeof subscribeToRoomFn
  abandonOperation: typeof abandonOperationFn
  applyRecommendation: typeof applyRecommendationFn
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
  const { createConversation, fetchConversation, startRound, subscribeToRoom, abandonOperation } = room
  const [projection, setProjection] = useState<ConversationProjection>(() =>
    initialRoundInFlight === null ? EMPTY_PROJECTION : withRoundInFlight(EMPTY_PROJECTION, initialRoundInFlight),
  )
  const [busy, setBusy] = useState(initialRoundInFlight !== null)
  const [error, setError] = useState<string | undefined>(undefined)
  const conversationIdRef = useRef<string | null>(initialConversationId)

  useEffect(() => {
    let active = true

    if (initialConversationId !== null) {
      void fetchConversation(pieceId, initialConversationId).then((result) => {
        if (!active) return
        if (result.outcome === 'value') {
          const loaded = initialProjection(result.value.rounds)
          setProjection((prev) => ({ rounds: [...loaded.rounds, ...prev.rounds] }))
          return
        }
        const message = failureMessage(result)
        if (message !== undefined) setError(message)
      })
    }

    const unsubscribe = subscribeToRoom(
      pieceId,
      (event) => {
        if (!active) return
        if (event.type === 'error') {
          // The room states its own failures and always closes the round after
          // one, so nothing here has to guess whether the round is still running.
          setError(event.data.message)
          return
        }
        if (event.type === 'round.opened') {
          conversationIdRef.current = event.data.conversationId
          setBusy(true)
        }
        if (event.type === 'round.closed') setBusy(false)
        setProjection((prev) => projectRoundEvent(prev, event))
      },
      (message) => {
        if (active) setError(message)
      },
    )

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

    /** The round is only under way once the server said so; until then this is what stops. */
    function stop(message: string | undefined): void {
      if (message !== undefined) setError(message)
      setBusy(false)
    }

    async function run(): Promise<void> {
      let conversationId = conversationIdRef.current
      if (conversationId === null) {
        const created = await createConversation(pieceId)
        if (created.outcome !== 'value') {
          stop(failureMessage(created))
          return
        }
        conversationId = created.value.id
        conversationIdRef.current = created.value.id
      }

      const result = await startRound(pieceId, conversationId, message, getDraft())
      if (result.outcome !== 'value') stop(failureMessage(result))
    }

    // Nothing above returns a rejected promise for any outcome the studio can
    // have, so this catch is for the one case left: something here threw. The
    // author is told, rather than watching a composer that stays busy forever.
    void run().catch((err: unknown) => {
      stop(err instanceof Error ? err.message : UNSENT)
    })
  }

  /**
   * UX_DESIGN "An operation in flight": offered for as long as one is running
   * and nothing more — the room reports its own stop through `round.closed`,
   * so this asks for that and otherwise touches no state itself. A studio that
   * cannot be reached is told the same way sending one is.
   */
  function abandon(): void {
    if (!busy) return
    void abandonOperation(pieceId).then((result) => {
      const message = failureMessage(result)
      if (message !== undefined) setError(message)
    })
  }

  return { projection, busy, error, sendMessage, abandon, conversationId: conversationIdRef.current }
}
