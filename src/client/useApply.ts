import { useState } from 'react'
import type { AppliedChange } from '../shared/appliedChange.js'
import type { abandonOperation as abandonOperationFn, applyRecommendation as applyRecommendationFn } from './roomClient.js'
import { failureMessage } from './request.js'

export type ApplyAdapters = Readonly<{
  applyRecommendation: typeof applyRecommendationFn
  abandonOperation: typeof abandonOperationFn
}>

export type ApplyingResponse = Readonly<{ roundId: string; participantId: string }>

export type ApplyViewModel = Readonly<{
  applying: ApplyingResponse | undefined
  error: string | undefined
  apply: (roundId: string, participantId: string, constraint: string | undefined) => void
  abandon: () => void
}>

export function useApply(
  pieceId: string,
  conversationId: string | null,
  getDraft: () => string,
  onApplied: (markdown: string) => void,
  onApplyingChange: (applying: boolean) => void,
  onChangeApplied: (roundId: string, participantId: string, change: AppliedChange) => void,
  adapters: ApplyAdapters,
): ApplyViewModel {
  const { applyRecommendation, abandonOperation } = adapters
  const [applying, setApplying] = useState<ApplyingResponse | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  function apply(roundId: string, participantId: string, constraint: string | undefined): void {
    if (applying !== undefined || conversationId === null) return
    const cid = conversationId
    setError(undefined)
    setApplying({ roundId, participantId })
    onApplyingChange(true)

    function stop(message: string | undefined): void {
      setApplying(undefined)
      onApplyingChange(false)
      if (message !== undefined) setError(message)
    }

    async function run(): Promise<void> {
      const result = await applyRecommendation(pieceId, cid, roundId, participantId, getDraft(), constraint)
      if (result.outcome !== 'value') {
        stop(failureMessage(result))
        return
      }

      const outcome = result.value
      if (outcome.outcome === 'applied') {
        stop(undefined)
        onApplied(outcome.manuscript)
        if (outcome.change !== undefined) onChangeApplied(roundId, participantId, outcome.change)
        return
      }
      if (outcome.outcome === 'failed') {
        stop(`the application did not settle — ${outcome.reason}`)
        return
      }
      stop(undefined)
    }

    void run().catch((err: unknown) => {
      stop(err instanceof Error ? err.message : 'the application was not sent')
    })
  }

  function abandon(): void {
    if (applying === undefined) return
    void abandonOperation(pieceId)
  }

  return { applying, error, apply, abandon }
}
