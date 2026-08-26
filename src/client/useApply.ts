import { useEffect, useState } from 'react'
import type { AutosaveState } from './autosave.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import type {
  abandonOperation as abandonOperationFn,
  applyRecommendation as applyRecommendationFn,
  confirmApplication as confirmApplicationFn,
  retrievePendingApply as retrievePendingApplyFn,
} from './roomClient.js'
import { failureMessage } from './request.js'
import type { ResumedApply } from './useConversation.js'

export type ApplyAdapters = Readonly<{
  applyRecommendation: typeof applyRecommendationFn
  confirmApplication: typeof confirmApplicationFn
  abandonOperation: typeof abandonOperationFn
  retrievePendingApply: typeof retrievePendingApplyFn
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
  resumed?: ResumedApply,
): ApplyViewModel {
  const { applyRecommendation, confirmApplication, abandonOperation, retrievePendingApply } = adapters
  const [applying, setApplying] = useState<ApplyingResponse | undefined>(resumed !== undefined ? { responseId: resumed.responseId } : undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  function stop(message: string | undefined): void {
    setApplying(undefined)
    if (message !== undefined) setError(message)
  }

  // A save, confirmation or retrieval failure leaves the server's pending Apply sitting at its
  // room scope; abandoning it is what frees that scope and closes out the action, same as the
  // author doing so by hand. Awaited rather than fired off, so this terminal failure is fully
  // settled — reported and unlocked — before the caller regains control.
  async function stopAndAbandon(cid: string, actionId: string, message: string | undefined): Promise<void> {
    stop(message)
    await abandonOperation(pieceId, surface, cid, actionId)
  }

  // Shared by a fresh Apply's 'pending' outcome and a resumed one's retrieved result: install
  // through the surface's one persistence owner, then confirm only once that write has durably
  // settled — the model is never called again to reach this point.
  async function installAndConfirm(cid: string, actionId: string, applicationId: string, manuscript: string): Promise<void> {
    const saved = await install(manuscript)
    if (saved.failed) {
      await stopAndAbandon(cid, actionId, saved.message)
      return
    }

    const confirmed = await confirmApplication(pieceId, surface, cid, applicationId)
    if (confirmed.outcome !== 'value') {
      await stopAndAbandon(cid, actionId, failureMessage(confirmed))
      return
    }
    stop(undefined)
  }

  // `resumed` can arrive after mount — the room reports it once the piece's event stream
  // connects, not synchronously with this hook's own render. Its `applicationId` is present only
  // once the model has already answered and left a replacement pending; while it is still
  // calling, there is nothing yet to retrieve and this surface simply stays busy until either the
  // room reports the call finished or the author abandons it.
  useEffect(() => {
    if (resumed === undefined || conversationId === null) return
    const cid = conversationId
    const actionId = resumed.actionId
    setApplying((current) => current ?? { responseId: resumed.responseId })
    if (resumed.applicationId === undefined) return
    const applicationId = resumed.applicationId

    let active = true

    async function resume(): Promise<void> {
      const result = await retrievePendingApply(pieceId, surface, cid, applicationId)
      if (!active) return
      if (result.outcome !== 'value') {
        await stopAndAbandon(cid, actionId, failureMessage(result))
        return
      }
      await installAndConfirm(cid, actionId, applicationId, result.value.manuscript)
    }

    void resume().catch((err: unknown) => {
      if (!active) return
      stop(err instanceof Error ? err.message : 'the application could not be resumed')
    })

    return () => {
      active = false
    }
  }, [resumed, conversationId])

  function apply(responseId: string, constraint: string | undefined): void {
    if (applying !== undefined || conversationId === null) return
    const cid = conversationId
    setError(undefined)
    setApplying({ responseId })

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

      // outcome.outcome === 'pending'
      await installAndConfirm(cid, outcome.actionId, outcome.applicationId, outcome.manuscript)
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
