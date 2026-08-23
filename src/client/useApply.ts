import { useState } from 'react'
import type { abandonOperation as abandonOperationFn, applyRecommendation as applyRecommendationFn } from './roomClient.js'
import { failureMessage } from './request.js'

export type ApplyAdapters = Readonly<{
  applyRecommendation: typeof applyRecommendationFn
  abandonOperation: typeof abandonOperationFn
}>

/** The response mid-application, identified the way a response is: the round and the participant it came from. */
export type ApplyingResponse = Readonly<{ roundId: string; participantId: string }>

export type ApplyViewModel = Readonly<{
  applying: ApplyingResponse | undefined
  error: string | undefined
  apply: (roundId: string, participantId: string, constraint: string | undefined) => void
  abandon: () => void
}>

/**
 * CONTEXT "Apply"/SPEC "Applying a recommendation": one call, reached by the
 * request that asked for it rather than by an event. Silent on success — the
 * manuscript changing is the whole of what the author is told — and silent on
 * abandonment too, which UX_DESIGN "Degraded and absent states" leaves
 * identical to the author's eye. Only a failure says anything, and even then
 * the recommendation stays applicable: nothing here disables it, remembers
 * that this attempt happened, or reasons about whether trying again is wise.
 */
export function useApply(
  pieceId: string,
  conversationId: string | null,
  getDraft: () => string,
  onApplied: (markdown: string) => void,
  onApplyingChange: (applying: boolean) => void,
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
        return
      }
      if (outcome.outcome === 'failed') {
        stop(`the application did not settle — ${outcome.reason}`)
        return
      }
      // Abandoned: nothing is said, on the same terms a settled abandon is silent.
      stop(undefined)
    }

    // See `useConversation.sendMessage`: nothing above returns a rejected
    // promise for any outcome the studio can have, so this catch is for the
    // one case left — something here threw before the request was even sent.
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
