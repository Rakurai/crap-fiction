import { useState } from 'react'
import type { CaptureDestination, CaptureProposal } from '../shared/captureProposal.js'
import type { approveCapture as approveCaptureFn, captureContext as captureContextFn } from './roomClient.js'
import { failureMessage } from './request.js'

export type CaptureAdapters = Readonly<{
  captureContext: typeof captureContextFn
  approveCapture: typeof approveCaptureFn
}>

export type CaptureViewModel = Readonly<{
  capturing: boolean
  proposals: readonly CaptureProposal[]
  approved: ReadonlySet<string>
  closing: boolean
  error: string | undefined
  capture: () => void
  toggle: (id: string) => void
  close: () => void
  discard: () => void
}>

export function useCapture(pieceId: string, conversationId: string | null, getDraft: () => string, adapters: CaptureAdapters): CaptureViewModel {
  const { captureContext, approveCapture } = adapters
  const [capturing, setCapturing] = useState(false)
  const [proposals, setProposals] = useState<readonly CaptureProposal[]>([])
  const [approved, setApproved] = useState<ReadonlySet<string>>(new Set())
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  function capture(): void {
    if (capturing || conversationId === null) return
    const cid = conversationId
    setError(undefined)
    setCapturing(true)

    async function run(): Promise<void> {
      const result = await captureContext(pieceId, cid, getDraft())
      setCapturing(false)
      if (result.outcome !== 'value') {
        setError(failureMessage(result))
        return
      }

      const outcome = result.value
      if (outcome.outcome === 'captured') {
        setProposals(outcome.proposals)
        setApproved(new Set())
        return
      }
      if (outcome.outcome === 'failed') {
        setError(`the analysis did not settle — ${outcome.reason}`)
        return
      }
    }

    void run().catch((err: unknown) => {
      setCapturing(false)
      setError(err instanceof Error ? err.message : 'the analysis was not sent')
    })
  }

  function toggle(id: string): void {
    setApproved((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function discard(): void {
    setProposals([])
    setApproved(new Set())
    setError(undefined)
  }

  function close(): void {
    const toApprove = proposals.filter((proposal) => approved.has(proposal.id))
    if (toApprove.length === 0) {
      discard()
      return
    }

    setError(undefined)
    setClosing(true)

    async function run(): Promise<void> {
      const result = await approveCapture(pieceId, toApprove)
      setClosing(false)
      if (result.outcome !== 'value') {
        setError(failureMessage(result))
        return
      }

      const outcome = result.value
      if (outcome.failures.length === 0) {
        discard()
        return
      }

      const failed: ReadonlySet<CaptureDestination> = new Set(outcome.failures.map((failure) => failure.destination))
      const stillOpen = proposals.filter((proposal) => failed.has(proposal.destination))
      setProposals(stillOpen)
      setApproved(new Set(stillOpen.filter((proposal) => approved.has(proposal.id)).map((proposal) => proposal.id)))
      setError(outcome.failures.map((failure) => `${failure.destination}: ${failure.message}`).join('; '))
    }

    void run().catch((err: unknown) => {
      setClosing(false)
      setError(err instanceof Error ? err.message : 'the approval was not sent')
    })
  }

  return { capturing, proposals, approved, closing, error, capture, toggle, close, discard }
}
