import { useEffect, useRef, useState } from 'react'
import type { Replacement } from '../shared/applyResult.js'
import type { AutosaveState } from './autosave.js'
import type { FailureReason } from '../shared/modelResult.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import type {
  applyRecommendation as applyRecommendationFn,
  confirmApplication as confirmApplicationFn,
  retrievePendingApply as retrievePendingApplyFn,
} from './roomClient.js'
import { failureMessage } from './request.js'
import type { ConversationViewModel, ResumedApply } from './useConversation.js'

export type ApplyAdapters = Readonly<{
  applyRecommendation: typeof applyRecommendationFn
  confirmApplication: typeof confirmApplicationFn
  retrievePendingApply: typeof retrievePendingApplyFn
}>

export type ApplyingResponse = Readonly<{ responseId: string }>

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
  abandonAction: ConversationViewModel['abandonAction'],
  resumed?: ResumedApply,
): ApplyViewModel {
  const { applyRecommendation, confirmApplication, retrievePendingApply } = adapters
  const [applying, setApplying] = useState<ApplyingResponse | undefined>(resumed !== undefined ? { responseId: resumed.responseId } : undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [settlement, setSettlement] = useState<ApplySettlement | undefined>(undefined)
  const startedHere = useRef(false)
  const resumingApplication = useRef<string | undefined>(undefined)
  const mounted = useRef(true)
  const applyController = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    return () => {
      mounted.current = false
      applyController.current?.abort()
    }
  }, [])

  function stop(message: string | undefined): void {
    startedHere.current = false
    resumingApplication.current = undefined
    if (!mounted.current) return
    setApplying(undefined)
    if (message !== undefined) setError(message)
  }

  async function stopAndAbandon(cid: string, actionId: string, message: string | undefined): Promise<void> {
    if (!(await abandonAction(cid, actionId, message))) return
    stop(message)
  }

  async function installAndConfirm(cid: string, actionId: string, applicationId: string, replacement: Replacement, signal: AbortSignal): Promise<void> {
    const saved = await install(replacement)
    if (saved.failed) {
      await stopAndAbandon(cid, actionId, saved.message)
      return
    }

    const confirmed = await confirmApplication(pieceId, surface, cid, applicationId, signal)
    if (confirmed.outcome !== 'value') {
      await stopAndAbandon(cid, actionId, failureMessage(confirmed))
      return
    }
    stop(undefined)
  }

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
    const controller = new AbortController()

    async function resume(): Promise<void> {
      const result = await retrievePendingApply(pieceId, surface, cid, applicationId, controller.signal)
      if (!active) return
      if (result.outcome !== 'value') {
        await stopAndAbandon(cid, actionId, failureMessage(result))
        return
      }
      await installAndConfirm(cid, actionId, applicationId, result.value.replacement, controller.signal)
    }

    void resume().catch((err: unknown) => {
      if (!active) return
      stop(err instanceof Error ? err.message : 'the application could not be resumed')
    })

    return () => {
      active = false
      controller.abort()
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
    const controller = new AbortController()
    applyController.current = controller

    async function run(): Promise<void> {
      const result = await applyRecommendation(pieceId, surface, cid, responseId, getDocuments(), constraint, controller.signal)
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
        if (mounted.current) setSettlement({ kind: 'abandoned', responseId })
        stop(undefined)
        return
      }
      if (outcome.outcome === 'failed') {
        if (mounted.current) setSettlement({ kind: 'failed', responseId, reason: outcome.reason, returned: outcome.returned })
        stop(undefined)
        return
      }

      await installAndConfirm(cid, outcome.actionId, outcome.applicationId, outcome.replacement, controller.signal)
    }

    void run().catch((err: unknown) => {
      stop(err instanceof Error ? err.message : 'the application was not sent')
    })
  }

  function clear(): void {
    if (applying !== undefined) setSettlement({ kind: 'abandoned', responseId: applying.responseId })
    startedHere.current = false
    setApplying(undefined)
  }

  return { applying, error, settlement, apply, clear }
}
