import { useCallback, useEffect, useRef, useState } from 'react'
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

export function usePiece(id: string, { fetchPiece, updatePiece }: PieceAdapters): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id, fetchPiece])
  const [state, setState] = useLoaded(load, [id])
  const [retitling, setRetitling] = useState(false)
  const [retitleError, setRetitleError] = useState<string | undefined>(undefined)
  const controllerRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const retitle = useCallback(
    (title: string) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      setRetitling(true)
      setRetitleError(undefined)
      void updatePiece(id, { title }, controller.signal).then((result) => {
        if (controllerRef.current !== controller) return
        controllerRef.current = undefined
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
