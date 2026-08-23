import { useCallback, useState } from 'react'
import type { PieceDetail } from '../shared/pieceViews.js'
import { useLoaded } from './load.js'
import { fetchPiece, setPieceCast } from './piecesClient.js'
import { failureMessage } from './request.js'

export type PieceViewModel =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly piece: PieceDetail
      /** The specialist a toggle is in flight for, so the surface disables that one row alone. */
      readonly castToggling: string | undefined
      readonly castError: string | undefined
      readonly toggleCast: (memberId: string) => void
    }
  | { readonly status: 'error'; readonly message: string }

/**
 * #13 "The room": toggling a specialist carries the piece's whole enabled
 * cast, computed from what this hook already loaded rather than a second read
 * — the same one-lightweight-action write `setPieceCast` composes. The
 * write's own answer becomes the piece's cast (CODING_STANDARDS "Client":
 * projecting the server's own response, not inventing a state it never
 * reported), the same way `usePieces` applies a creation's result rather than
 * re-scanning.
 */
export function usePiece(id: string): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id])
  const [state, setState] = useLoaded(load, [id])
  const [castToggling, setCastToggling] = useState<string | undefined>(undefined)
  const [castError, setCastError] = useState<string | undefined>(undefined)

  const toggleCast = useCallback(
    (memberId: string) => {
      if (state.kind !== 'ready') return
      const piece = state.value
      const target = piece.cast.find((member) => member.id === memberId)
      if (target === undefined) return

      const nextEnabled = piece.cast.filter((member) => (member.id === memberId ? !member.enabled : member.enabled)).map((member) => member.id)

      setCastToggling(memberId)
      setCastError(undefined)
      void setPieceCast(id, nextEnabled).then((result) => {
        setCastToggling(undefined)
        if (result.outcome === 'value') {
          setState({ kind: 'ready', value: { ...piece, cast: result.value } })
          return
        }
        setCastError(failureMessage(result))
      })
    },
    [id, state],
  )

  if (state.kind === 'loading') return { status: 'loading' }
  if (state.kind === 'error') return { status: 'error', message: state.message }
  return { status: 'ready', piece: state.value, castToggling, castError, toggleCast }
}
