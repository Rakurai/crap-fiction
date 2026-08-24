import { useEffect, useRef, useState } from 'react'
import type { AppliedChange } from '../shared/appliedChange.js'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import type {
  abandonOperation as abandonOperationFn,
  applyRecommendation as applyRecommendationFn,
  createConversation as createConversationFn,
  fetchConversation as fetchConversationFn,
  RoundOpening,
  startRound as startRoundFn,
  subscribeToRoom as subscribeToRoomFn,
} from './roomClient.js'
import { failureMessage } from './request.js'
import {
  EMPTY_PROJECTION,
  initialProjection,
  projectRoundEvent,
  withAppliedChange,
  withRoundInFlight,
  type ConversationProjection,
} from './roundProjection.js'

const UNSENT = 'the message was not sent'

export type ConversationViewModel = Readonly<{
  projection: ConversationProjection
  busy: boolean
  error: string | undefined
  sendMessage: (message: string) => void
  reply: (participantId: string, message: string) => void
  askForConcreteChange: (roundId: string, participantId: string, clarification: string | undefined) => void
  abandon: () => void
  conversationId: string | null
  attachAppliedChange: (roundId: string, participantId: string, change: AppliedChange) => void
}>

export type RoomAdapters = Readonly<{
  createConversation: typeof createConversationFn
  fetchConversation: typeof fetchConversationFn
  startRound: typeof startRoundFn
  subscribeToRoom: typeof subscribeToRoomFn
  abandonOperation: typeof abandonOperationFn
  applyRecommendation: typeof applyRecommendationFn
}>

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
  // Held rather than read from the prop below: this hook mints an id on a fresh conversation's
  // first round and reports it upward, and depending on the prop would rebuild the event stream
  // in the moment that round is opening. The author switching is a remount, not a changed prop.
  const [openedWithConversationId] = useState(initialConversationId)

  useEffect(() => {
    let active = true

    if (openedWithConversationId !== null) {
      void fetchConversation(pieceId, openedWithConversationId).then((result) => {
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
  }, [pieceId, openedWithConversationId])

  function openRound(opening: RoundOpening): void {
    if (busy) return
    flushDraft()
    setError(undefined)
    setBusy(true)

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

      const result = await startRound(pieceId, conversationId, opening, getDraft())
      if (result.outcome !== 'value') stop(failureMessage(result))
    }

    void run().catch((err: unknown) => {
      stop(err instanceof Error ? err.message : UNSENT)
    })
  }

  function sendMessage(message: string): void {
    openRound({ message })
  }

  function reply(participantId: string, message: string): void {
    openRound({ target: participantId, message })
  }

  function askForConcreteChange(roundId: string, participantId: string, clarification: string | undefined): void {
    openRound({ respondingTo: { roundId, participantId }, clarification })
  }

  function abandon(): void {
    if (!busy) return
    void abandonOperation(pieceId).then((result) => {
      const message = failureMessage(result)
      if (message !== undefined) setError(message)
    })
  }

  function attachAppliedChange(roundId: string, participantId: string, change: AppliedChange): void {
    setProjection((prev) => withAppliedChange(prev, roundId, participantId, change))
  }

  return {
    projection,
    busy,
    error,
    sendMessage,
    reply,
    askForConcreteChange,
    abandon,
    conversationId: conversationIdRef.current,
    attachAppliedChange,
  }
}
