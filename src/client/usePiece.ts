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
      readonly retitling: boolean
      readonly retitleError: string | undefined
      readonly retitle: (title: string) => void
      readonly settingStatus: boolean
      readonly statusError: string | undefined
      readonly setStatus: (status: PieceStatus) => void
    }
  | { readonly status: 'error'; readonly message: string }

/**
 * The open piece itself: what it is called and how far along it is, which belong to the piece rather
 * than to any one of its surfaces. Everything scoped to a surface — its cast, its conversations, its
 * document — is that surface's own to hold.
 */
export function usePiece(id: string): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id])
  const [state, setState] = useLoaded(load, [id])
  const [retitling, setRetitling] = useState(false)
  const [retitleError, setRetitleError] = useState<string | undefined>(undefined)
  const [settingStatus, setSettingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | undefined>(undefined)

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
    retitling,
    retitleError,
    retitle,
    settingStatus,
    statusError,
    setStatus,
  }
}
