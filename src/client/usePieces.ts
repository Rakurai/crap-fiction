import { useCallback, useState } from 'react'
import type { ModeSummary } from '../shared/modeViews.js'
import type { PieceSummary } from '../shared/pieceViews.js'
import { useLoaded } from './load.js'
import { fetchModes } from './modesClient.js'
import { createPiece, fetchPieces } from './piecesClient.js'
import { failureMessage } from './request.js'

export type PiecesViewModel =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly pieces: readonly PieceSummary[]
      readonly modes: readonly ModeSummary[]
      readonly creating: boolean
      readonly createError: string | undefined
      readonly create: (title: string, mode: string) => void
    }

export function usePieces(refreshKey?: unknown): PiecesViewModel {
  const [load, setLoad] = useLoaded(fetchPieces, [refreshKey])
  const [modes] = useLoaded(fetchModes, [])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>(undefined)

  const create = useCallback((title: string, mode: string) => {
    setCreating(true)
    setCreateError(undefined)
    void createPiece(title, mode).then((result) => {
      setCreating(false)
      if (result.outcome === 'value') {
        const piece = result.value
        setLoad((current) => (current.kind === 'ready' ? { kind: 'ready', value: [piece, ...current.value] } : current))
        return
      }
      setCreateError(failureMessage(result))
    })
  }, [])

  if (load.kind === 'loading' || modes.kind === 'loading') return { status: 'loading' }
  if (load.kind === 'error') return { status: 'error', message: load.message }
  if (modes.kind === 'error') return { status: 'error', message: modes.message }
  return { status: 'ready', pieces: load.value, modes: modes.value, creating, createError, create }
}
