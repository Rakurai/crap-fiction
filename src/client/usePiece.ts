import { useEffect, useState } from 'react'
import type { PieceSummary } from '../server/pieces.js'
import { fetchPiece } from './piecesClient.js'

export type PieceViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly piece: PieceSummary }
  | { readonly status: 'error'; readonly message: string }

export function usePiece(id: string): PieceViewModel {
  const [state, setState] = useState<PieceViewModel>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchPiece(id)
      .then((piece) => {
        if (!cancelled) setState({ status: 'ready', piece })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof Error ? err.message : 'failed to open piece' })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return state
}
