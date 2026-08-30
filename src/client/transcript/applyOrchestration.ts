import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParticipantResponseEntry } from '../../shared/conversationEntries.js'
import type { DocumentSnapshot, SurfaceId } from '../../shared/surfaces.js'
import { useScopeActivity } from '../eventStream/RoomStreamProvider.js'
import type { DocumentSession } from '../pieceSession/documentSession.js'
import { confirmApply, fetchPendingReplacement, useAbandonAction, useApplyRecommendation } from '../servedFacts/resources.js'

export type ApplyOrchestration = Readonly<{
  apply: (response: ParticipantResponseEntry, constraint: string | undefined, documents: DocumentSnapshot) => void
  abandon: (actionId: string) => void
  holdReason: string | null
}>

export function useApplyOrchestration(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string,
  document: DocumentSession | null,
): ApplyOrchestration {
  const { mutate: applyMutate } = useApplyRecommendation(pieceId, surface, conversationId)
  const { mutate: abandonMutate } = useAbandonAction(pieceId, surface, conversationId)
  const scopeActivity = useScopeActivity(surface)
  const [holdReason, setHoldReason] = useState<string | null>(null)
  const settledApplicationIds = useRef<Set<string>>(new Set())

  const abandon = useCallback((actionId: string) => abandonMutate(actionId), [abandonMutate])

  const abandonWithReason = useCallback(
    (actionId: string, reason: string) => {
      setHoldReason(reason)
      abandonMutate(actionId)
    },
    [abandonMutate],
  )

  const settle = useCallback(
    async (actionId: string, applicationId: string, replacement: string) => {
      if (document === null) return
      document.installReplacement(replacement)
      const outcome = await document.flushAndSettle()
      if (outcome === 'failing') {
        abandonWithReason(actionId, 'the change could not be saved')
        return
      }
      try {
        await confirmApply(pieceId, surface, conversationId, applicationId)
      } catch {
        abandonWithReason(actionId, 'the change could not be confirmed')
      }
    },
    [document, pieceId, surface, conversationId, abandonWithReason],
  )

  useEffect(() => {
    if (document === null) return
    if (scopeActivity.status !== 'busy' || scopeActivity.action.kind !== 'apply') return
    const { actionId, applicationId } = scopeActivity.action
    if (applicationId === undefined || settledApplicationIds.current.has(applicationId)) return
    settledApplicationIds.current.add(applicationId)
    let cancelled = false
    void (async () => {
      let replacement: string
      try {
        replacement = await fetchPendingReplacement(pieceId, surface, conversationId, applicationId)
      } catch {
        if (!cancelled) abandonWithReason(actionId, 'the pending change could not be retrieved')
        return
      }
      if (!cancelled) await settle(actionId, applicationId, replacement)
    })()
    return () => {
      cancelled = true
    }
  }, [scopeActivity, document, pieceId, surface, conversationId, settle, abandonWithReason])

  useEffect(() => {
    if (scopeActivity.status !== 'busy') setHoldReason(null)
  }, [scopeActivity.status])

  const apply = useCallback(
    (response: ParticipantResponseEntry, constraint: string | undefined, documents: DocumentSnapshot) => {
      applyMutate(
        constraint === undefined ? { responseId: response.id, documents } : { responseId: response.id, constraint, documents },
        {
          onSuccess: (outcome) => {
            if (outcome.outcome !== 'pending') return
            settledApplicationIds.current.add(outcome.applicationId)
            void settle(outcome.actionId, outcome.applicationId, outcome.replacement)
          },
        },
      )
    },
    [applyMutate, settle],
  )

  return { apply, abandon, holdReason }
}
