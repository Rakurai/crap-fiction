import { useCallback } from 'react'
import type { PieceDetail } from '../shared/pieceViews.js'
import { useLoaded } from './load.js'
import { fetchPiece } from './piecesClient.js'

export type PieceViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly piece: PieceDetail }
  | { readonly status: 'error'; readonly message: string }

export function usePiece(id: string): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id])
  const [state] = useLoaded(load, [id])

  if (state.kind === 'loading') return { status: 'loading' }
  if (state.kind === 'error') return { status: 'error', message: state.message }
  return { status: 'ready', piece: state.value }
}
