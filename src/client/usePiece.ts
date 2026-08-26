import { useCallback, useState } from 'react'
import type { PieceDetail } from '../shared/pieceViews.js'
import { useLoaded } from './load.js'
import type { fetchPiece as fetchPieceFn, updatePiece as updatePieceFn } from './piecesClient.js'
import { failureMessage } from './request.js'

export type PieceAdapters = Readonly<{
  fetchPiece: typeof fetchPieceFn
  updatePiece: typeof updatePieceFn
}>

export type PieceViewModel =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly piece: PieceDetail
      readonly retitling: boolean
      readonly retitleError: string | undefined
      readonly retitle: (title: string) => void
    }
  | { readonly status: 'error'; readonly message: string }

/**
 * The open piece itself: what it is called, which belongs to the piece rather than to any one of its
 * surfaces. Everything scoped to a surface — its cast, its conversations, its document — is that
 * surface's own to hold.
 */
export function usePiece(id: string, { fetchPiece, updatePiece }: PieceAdapters): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id, fetchPiece])
  const [state, setState] = useLoaded(load, [id])
  const [retitling, setRetitling] = useState(false)
  const [retitleError, setRetitleError] = useState<string | undefined>(undefined)

  const retitle = useCallback(
    (title: string) => {
      setRetitling(true)
      setRetitleError(undefined)
      void updatePiece(id, { title }).then((result) => {
        setRetitling(false)
        if (result.outcome === 'value') {
          setState({ kind: 'ready', value: result.value })
          return
        }
        setRetitleError(failureMessage(result))
      })
    },
    [id, updatePiece],
  )

  if (state.kind === 'loading') return { status: 'loading' }
  if (state.kind === 'error') return { status: 'error', message: state.message }
  return {
    status: 'ready',
    piece: state.value,
    retitling,
    retitleError,
    retitle,
  }
}
