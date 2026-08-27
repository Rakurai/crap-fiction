import { useEffect, useRef, useState } from 'react'
import type { AutosaveState } from './autosave.js'
import type { FailureReason } from '../shared/modelResult.js'
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

/** Which of the two the author needs told apart when deciding whether to try again. */
export type ApplySettlement = Readonly<
  | { readonly kind: 'failed'; readonly responseId: string; readonly reason: FailureReason; readonly returned: string | undefined }
  | { readonly kind: 'abandoned'; readonly responseId: string }
>

export type ApplyViewModel = Readonly<{
  applying: ApplyingResponse | undefined
  error: string | undefined
  settlement: ApplySettlement | undefined
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
  const [settlement, setSettlement] = useState<ApplySettlement | undefined>(undefined)
  const startedHere = useRef(false)
  const resumingApplication = useRef<string | undefined>(undefined)

  function stop(message: string | undefined): void {
    startedHere.current = false
    resumingApplication.current = undefined
    setApplying(undefined)
    if (message !== undefined) setError(message)
  }

  // A save, confirmation or retrieval failure leaves the server's pending Apply sitting at its room
  // scope; abandoning it is what frees that scope and closes out the action, same as the author
  // doing so by hand. The document is released only once the room has answered that it is free: an
  // abandonment that failed leaves the room still holding the Apply, and unlocking here would
  // invite an edit the room's own pending replacement is about to contradict.
  async function stopAndAbandon(cid: string, actionId: string, message: string | undefined): Promise<void> {
    const abandoned = await abandonOperation(pieceId, surface, cid, actionId)
    const unfreed = failureMessage(abandoned)
    if (unfreed !== undefined) {
      setError(message === undefined ? unfreed : `${message} — ${unfreed}`)
      return
    }
    stop(message)
  }

  // Shared by a fresh Apply's 'pending' outcome and a resumed one's retrieved result: install
  // through the surface's one persistence owner, then confirm only once that write has durably
  // settled — the model is never called again to reach this point.
  async function installAndConfirm(cid: string, actionId: string, applicationId: string, replacement: string): Promise<void> {
    const saved = await install(replacement)
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
    if (startedHere.current) return
    const cid = conversationId
    const actionId = resumed.actionId
    setApplying((current) => current ?? { responseId: resumed.responseId })
    if (resumed.applicationId === undefined) return
    const applicationId = resumed.applicationId
    if (resumingApplication.current === applicationId) return
    resumingApplication.current = applicationId

    let active = true

    async function resume(): Promise<void> {
      const result = await retrievePendingApply(pieceId, surface, cid, applicationId)
      if (!active) return
      if (result.outcome !== 'value') {
        await stopAndAbandon(cid, actionId, failureMessage(result))
        return
      }
      await installAndConfirm(cid, actionId, applicationId, result.value.replacement)
    }

    void resume().catch((err: unknown) => {
      if (!active) return
      stop(err instanceof Error ? err.message : 'the application could not be resumed')
    })

    return () => {
      active = false
      if (resumingApplication.current === applicationId) resumingApplication.current = undefined
    }
  }, [resumed, conversationId])

  function apply(responseId: string, constraint: string | undefined): void {
    if (applying !== undefined || conversationId === null) return
    const cid = conversationId
    startedHere.current = true
    setError(undefined)
    setSettlement(undefined)
    setApplying({ responseId })

    async function run(): Promise<void> {
      const result = await applyRecommendation(pieceId, surface, cid, responseId, getDocuments(), constraint)
      if (result.outcome !== 'value') {
        stop(failureMessage(result))
        return
      }

      const outcome = result.value
      if (outcome.outcome === 'noChange') {
        stop(undefined)
        return
      }
      if (outcome.outcome === 'abandoned') {
        setSettlement({ kind: 'abandoned', responseId })
        stop(undefined)
        return
      }
      if (outcome.outcome === 'failed') {
        setSettlement({ kind: 'failed', responseId, reason: outcome.reason, returned: outcome.returned })
        stop(undefined)
        return
      }

      await installAndConfirm(cid, outcome.actionId, outcome.applicationId, outcome.replacement)
    }

    void run().catch((err: unknown) => {
      stop(err instanceof Error ? err.message : 'the application was not sent')
    })
  }

  // The author's own act of stopping an Apply in flight, distinct from the model reporting one of
  // its own outcomes above: what the document is left in is identical, but this one stamps
  // "abandoned" rather than "failed" because the author did it rather than the machine breaking.
  function clear(): void {
    if (applying !== undefined) setSettlement({ kind: 'abandoned', responseId: applying.responseId })
    startedHere.current = false
    setApplying(undefined)
  }

  return { applying, error, settlement, apply, clear }
}
