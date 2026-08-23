import { useCallback, useState } from 'react'
import type { PieceDetail, PieceStatus } from '../shared/pieceViews.js'
import { useLoaded } from './load.js'
import { fetchPiece, updatePiece } from './piecesClient.js'
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
      /** #19 "Piece lifecycle": true while a retitle is in flight, so the title control refuses a second one. */
      readonly retitling: boolean
      readonly retitleError: string | undefined
      readonly retitle: (title: string) => void
      /** #19 "Piece lifecycle": true while a status change is in flight. */
      readonly settingStatus: boolean
      readonly statusError: string | undefined
      readonly setStatus: (status: PieceStatus) => void
    }
  | { readonly status: 'error'; readonly message: string }

/**
 * #13 "The room": toggling a specialist carries the piece's whole enabled
 * cast, computed from what this hook already loaded rather than a second read
 * — the same one-lightweight-action write `updatePiece` composes for #19's
 * retitle and status too. The write's own answer replaces the whole piece
 * (CODING_STANDARDS "Client": projecting the server's own response, not
 * inventing a state it never reported), the same way `usePieces` applies a
 * creation's result rather than re-scanning.
 */
export function usePiece(id: string): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id])
  const [state, setState] = useLoaded(load, [id])
  const [castToggling, setCastToggling] = useState<string | undefined>(undefined)
  const [castError, setCastError] = useState<string | undefined>(undefined)
  const [retitling, setRetitling] = useState(false)
  const [retitleError, setRetitleError] = useState<string | undefined>(undefined)
  const [settingStatus, setSettingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | undefined>(undefined)

  const toggleCast = useCallback(
    (memberId: string) => {
      if (state.kind !== 'ready') return
      const piece = state.value
      const target = piece.cast.find((member) => member.id === memberId)
      if (target === undefined) return

      const nextEnabled = piece.cast.filter((member) => (member.id === memberId ? !member.enabled : member.enabled)).map((member) => member.id)

      setCastToggling(memberId)
      setCastError(undefined)
      void updatePiece(id, { cast: nextEnabled }).then((result) => {
        setCastToggling(undefined)
        if (result.outcome === 'value') {
          setState({ kind: 'ready', value: result.value })
          return
        }
        setCastError(failureMessage(result))
      })
    },
    [id, state],
  )

  /**
   * #19 "Piece lifecycle": retitling changes the title alone — the directory
   * is fixed at creation and this call never touches it — and nothing here
   * asks whether the piece is open elsewhere or mid-round, because nothing
   * about a piece's status or title gates anything.
   */
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
    [id],
  )

  /** #19 "Piece lifecycle": marking a piece finished or abandoned carries no rationale and refuses no transition. */
  const setStatus = useCallback(
    (status: PieceStatus) => {
      setSettingStatus(true)
      setStatusError(undefined)
      void updatePiece(id, { status }).then((result) => {
        setSettingStatus(false)
        if (result.outcome === 'value') {
          setState({ kind: 'ready', value: result.value })
          return
        }
        setStatusError(failureMessage(result))
      })
    },
    [id],
  )

  if (state.kind === 'loading') return { status: 'loading' }
  if (state.kind === 'error') return { status: 'error', message: state.message }
  return {
    status: 'ready',
    piece: state.value,
    castToggling,
    castError,
    toggleCast,
    retitling,
    retitleError,
    retitle,
    settingStatus,
    statusError,
    setStatus,
  }
}
