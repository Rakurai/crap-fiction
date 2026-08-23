import { useCallback, useEffect, useState } from 'react'
import type { PieceSummary } from '../server/pieces.js'
import { createPiece, fetchPieces } from './piecesClient.js'
import { isAbortError } from './request.js'

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

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly pieces: readonly PieceSummary[] }

/**
 * Owns the piece listing and creation (SPEC "Files": listing is a directory
 * scan, so a created piece is appended to what was already loaded rather
 * than triggering a second scan).
 */
export function usePieces(): PiecesViewModel {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    fetchPieces(controller.signal)
      .then((pieces) => setLoad({ kind: 'ready', pieces }))
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setLoad({ kind: 'error', message: err instanceof Error ? err.message : 'failed to load pieces' })
      })
    return () => controller.abort()
  }, [])

  const create = useCallback((title: string) => {
    setCreating(true)
    setCreateError(undefined)
    createPiece(title)
      .then((result) => {
        setCreating(false)
        if (result.ok) {
          setLoad((current) => (current.kind === 'ready' ? { kind: 'ready', pieces: [result.piece, ...current.pieces] } : current))
        } else {
          setCreateError(result.message)
        }
      })
      .catch((err: unknown) => {
        setCreating(false)
        setCreateError(err instanceof Error ? err.message : 'failed to create piece')
      })
  }, [])

  if (load.kind === 'loading') return { status: 'loading' }
  if (load.kind === 'error') return { status: 'error', message: load.message }
  return { status: 'ready', pieces: load.pieces, creating, createError, create }
}
