import { useEffect, useState } from 'react'
import type { AutosaveState } from './autosave.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import type {
  abandonOperation as abandonOperationFn,
  applyRecommendation as applyRecommendationFn,
  confirmApplication as confirmApplicationFn,
} from './roomClient.js'
import { failureMessage } from './request.js'

export type ApplyAdapters = Readonly<{
  applyRecommendation: typeof applyRecommendationFn
  confirmApplication: typeof confirmApplicationFn
  abandonOperation: typeof abandonOperationFn
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
  surface: SurfaceId,
  conversationId: string | null,
  getDocuments: () => DocumentSnapshot,
  install: (markdown: string) => Promise<AutosaveState>,
  adapters: ApplyAdapters,
  initialApplying?: ApplyingResponse,
): ApplyViewModel {
  const { applyRecommendation, confirmApplication, abandonOperation } = adapters
  const [applying, setApplying] = useState<ApplyingResponse | undefined>(initialApplying)
  const [error, setError] = useState<string | undefined>(undefined)

  // `initialApplying` can arrive after mount — the room reports it once the piece's event stream
  // connects, not synchronously with this hook's own render.
  useEffect(() => {
    if (initialApplying !== undefined) setApplying((current) => current ?? initialApplying)
  }, [initialApplying])

  function apply(responseId: string, constraint: string | undefined): void {
    if (applying !== undefined || conversationId === null) return
    const cid = conversationId
    setError(undefined)
    setApplying({ responseId })

    function stop(message: string | undefined): void {
      setApplying(undefined)
      if (message !== undefined) setError(message)
    }

    // A save or confirmation failure leaves the server's pending Apply sitting at its room
    // scope; abandoning it is what frees that scope and closes out the action, same as the
    // author doing so by hand. Awaited rather than fired off, so this terminal failure is fully
    // settled — reported and unlocked — before `apply` returns control to its caller.
    async function stopAndAbandon(actionId: string, message: string | undefined): Promise<void> {
      stop(message)
      await abandonOperation(pieceId, surface, cid, actionId)
    }

    async function run(): Promise<void> {
      const result = await applyRecommendation(pieceId, surface, cid, responseId, getDocuments(), constraint)
      if (result.outcome !== 'value') {
        stop(failureMessage(result))
        return
      }

      const outcome = result.value
      if (outcome.outcome === 'noChange' || outcome.outcome === 'abandoned') {
        stop(undefined)
        return
      }
      if (outcome.outcome === 'failed') {
        stop(`the application did not settle — ${outcome.reason}`)
        return
      }

      // outcome.outcome === 'pending': install the replacement through the surface's one
      // persistence owner, then confirm only once that write has durably settled.
      const saved = await install(outcome.manuscript)
      if (saved.failed) {
        await stopAndAbandon(outcome.actionId, saved.message)
        return
      }

      const confirmed = await confirmApplication(pieceId, surface, cid, outcome.applicationId)
      if (confirmed.outcome !== 'value') {
        await stopAndAbandon(outcome.actionId, failureMessage(confirmed))
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
