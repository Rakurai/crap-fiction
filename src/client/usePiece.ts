import { useEffect, useState } from 'react'
import type { PieceDetail } from '../shared/pieceViews.js'
import { fetchPiece } from './piecesClient.js'
import { isAbortError } from './request.js'

export type PieceViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly piece: PieceDetail }
  | { readonly status: 'error'; readonly message: string }

export function usePiece(id: string): PieceViewModel {
  const [state, setState] = useState<PieceViewModel>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetchPiece(id, controller.signal)
      .then((piece) => setState({ status: 'ready', piece }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setState({ status: 'error', message: err instanceof Error ? err.message : 'failed to open piece' })
      })
    return () => controller.abort()
  }, [id])

  return state
}
