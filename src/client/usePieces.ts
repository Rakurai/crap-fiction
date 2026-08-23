import { useCallback, useState } from 'react'
import type { PieceSummary } from '../shared/pieceViews.js'
import { useLoaded } from './load.js'
import { createPiece, fetchPieces } from './piecesClient.js'
import { failureMessage } from './request.js'

export type PiecesViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly pieces: readonly PieceSummary[]
      readonly creating: boolean
      readonly createError: string | undefined
      readonly create: (title: string) => void
    }

/**
 * Owns the piece listing and creation (SPEC "Files": listing is a directory
 * scan, so a created piece is appended to what was already loaded rather
 * than triggering a second scan).
 *
 * `refreshKey` re-scans on change. A scan here is not the wasteful round
 * trip `useLoaded`'s own doc warns against — that is for a write this hook
 * itself just made, whose result it already holds — and does not cover a
 * retitle or a status or draft change made while the piece was open, which
 * this hook never saw happen (#19 "Piece lifecycle": switching pieces
 * costs no save step, not a truthful listing on return).
 */
export function usePieces(refreshKey?: unknown): PiecesViewModel {
  const [load, setLoad] = useLoaded(fetchPieces, [refreshKey])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>(undefined)

  const create = useCallback((title: string) => {
    setCreating(true)
    setCreateError(undefined)
    void createPiece(title).then((result) => {
      setCreating(false)
      if (result.outcome === 'value') {
        const piece = result.value
        setLoad((current) => (current.kind === 'ready' ? { kind: 'ready', value: [piece, ...current.value] } : current))
        return
      }
      setCreateError(failureMessage(result))
    })
  }, [])

  if (load.kind === 'loading') return { status: 'loading' }
  if (load.kind === 'error') return { status: 'error', message: load.message }
  return { status: 'ready', pieces: load.value, creating, createError, create }
}
