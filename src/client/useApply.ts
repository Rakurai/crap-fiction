import { useState } from 'react'
import type { applyRecommendation as applyRecommendationFn } from './roomClient.js'
import { failureMessage } from './request.js'

export type ApplyAdapters = Readonly<{
  applyRecommendation: typeof applyRecommendationFn
}>

export type ApplyingResponse = Readonly<{ responseId: string }>

export type ApplyViewModel = Readonly<{
  applying: ApplyingResponse | undefined
  error: string | undefined
  apply: (responseId: string, constraint: string | undefined) => void
  clear: () => void
}>

export function useApply(
  pieceId: string,
  conversationId: string | null,
  getDraft: () => string,
  onApplied: (markdown: string) => void,
  adapters: ApplyAdapters,
  initialApplying?: ApplyingResponse,
): ApplyViewModel {
  const { applyRecommendation } = adapters
  const [applying, setApplying] = useState<ApplyingResponse | undefined>(initialApplying)
  const [error, setError] = useState<string | undefined>(undefined)

  function apply(responseId: string, constraint: string | undefined): void {
    if (applying !== undefined || conversationId === null) return
    const cid = conversationId
    setError(undefined)
    setApplying({ responseId })

    function stop(message: string | undefined): void {
      setApplying(undefined)
      if (message !== undefined) setError(message)
    }

    async function run(): Promise<void> {
      const result = await applyRecommendation(pieceId, cid, responseId, getDraft(), constraint)
      if (result.outcome !== 'value') {
        stop(failureMessage(result))
        return
      }

      const outcome = result.value
      if (outcome.outcome === 'applied') {
        stop(undefined)
        onApplied(outcome.manuscript)
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

  function clear(): void {
    setApplying(undefined)
  }

  return { applying, error, apply, clear }
}
