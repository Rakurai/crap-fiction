import { useCallback, useEffect, useState } from 'react'
import type { PieceSummary } from '../server/pieces.js'
import { createPiece, fetchPieces } from './piecesClient.js'

export type PiecesViewModel =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly pieces: readonly PieceSummary[]
      readonly creating: boolean
      readonly createError: string | undefined
      readonly create: (title: string) => void
    }

/**
 * Owns the piece listing and creation (SPEC "Files": listing is a directory
 * scan, so a created piece is appended to what was already loaded rather
 * than triggering a second scan).
 */
export function usePieces(): PiecesViewModel {
  const [pieces, setPieces] = useState<readonly PieceSummary[] | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetchPieces().then((value) => {
      if (!cancelled) setPieces(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const create = useCallback((title: string) => {
    setCreating(true)
    setCreateError(undefined)
    createPiece(title).then((result) => {
      setCreating(false)
      if (result.ok) {
        setPieces((current) => [result.piece, ...(current ?? [])])
      } else {
        setCreateError(result.message)
      }
    })
  }, [])

  if (pieces === undefined) return { status: 'loading' }
  return { status: 'ready', pieces, creating, createError, create }
}
