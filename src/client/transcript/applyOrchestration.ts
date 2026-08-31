import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApplyOutcome } from '../../shared/applyViews.js'
import type { ParticipantResponseEntry } from '../../shared/conversationEntries.js'
import type { DocumentSnapshot, SurfaceId } from '../../shared/surfaces.js'
import { useScopeActivity } from '../eventStream/RoomStreamProvider.js'
import type { DocumentSession } from '../pieceSession/documentSession.js'
import { confirmApply, fetchPendingReplacement, useAbandonAction, useApplyRecommendation } from '../servedFacts/resources.js'
import { APPLY_FAILURE_TEXT } from './failureText.js'

type ApplyOrchestration = Readonly<{
  apply: (response: ParticipantResponseEntry, constraint: string | undefined, documents: DocumentSnapshot) => void
  abandon: (actionId: string) => void
  statement: string | null
}>

function failureStatement(outcome: Extract<ApplyOutcome, { outcome: 'failed' }>): string {
  const returned = 'returned' in outcome ? outcome.returned : undefined
  const detail = returned === undefined ? '' : `: ${returned}`
  return `the change could not be applied — ${APPLY_FAILURE_TEXT[outcome.reason]}${detail}`
}

export function useApplyOrchestration(
  pieceId: string,
  surface: SurfaceId,
  conversationId: string,
  document: DocumentSession | null,
): ApplyOrchestration {
  const { mutate: applyMutate } = useApplyRecommendation(pieceId, surface, conversationId)
  const { mutate: abandonMutate } = useAbandonAction(pieceId, surface)
  const scopeActivity = useScopeActivity(surface)
  const [statement, setStatement] = useState<string | null>(null)
  const settledApplicationIds = useRef<Set<string>>(new Set())

  const claimApplication = useCallback((applicationId: string) => {
    if (settledApplicationIds.current.has(applicationId)) return false
    settledApplicationIds.current.add(applicationId)
    setStatement(null)
    return true
  }, [])

  const abandon = useCallback((actionId: string) => abandonMutate({ conversationId, actionId }), [abandonMutate, conversationId])

  const abandonWithReason = useCallback(
    (actionId: string, reason: string) => {
      setStatement(reason)
      abandonMutate({ conversationId, actionId })
    },
    [abandonMutate, conversationId],
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
    if (applicationId === undefined || !claimApplication(applicationId)) return
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
  }, [scopeActivity, document, pieceId, surface, conversationId, settle, abandonWithReason, claimApplication])

  const apply = useCallback(
    (response: ParticipantResponseEntry, constraint: string | undefined, documents: DocumentSnapshot) => {
      setStatement(null)
      applyMutate(
        constraint === undefined ? { responseId: response.id, documents } : { responseId: response.id, constraint, documents },
        {
          onSuccess: (outcome) => {
            switch (outcome.outcome) {
              case 'pending':
                if (claimApplication(outcome.applicationId)) void settle(outcome.actionId, outcome.applicationId, outcome.replacement)
                return
              case 'noChange':
                setStatement('the recommendation was applied and nothing changed')
                return
              case 'failed':
                setStatement(failureStatement(outcome))
                return
              case 'abandoned':
                setStatement('the application was abandoned')
                return
              default: {
                const exhaustive: never = outcome
                return exhaustive
              }
            }
          },
        },
      )
    },
    [applyMutate, settle, claimApplication],
  )

  return { apply, abandon, statement }
}
