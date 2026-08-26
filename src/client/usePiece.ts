import { useCallback, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { PieceDetail, PieceStatus } from '../shared/pieceViews.js'
import type { PieceSurfaceId } from '../shared/surfaces.js'
import { useLoaded } from './load.js'
import { fetchPiece, updatePiece } from './piecesClient.js'
import { failureMessage } from './request.js'
import { deleteConversation as deleteConversationRequest } from './roomClient.js'

/** A value held per editing surface, so one surface's state never bleeds into another's. */
type BySurface<T> = Readonly<Partial<Record<PieceSurfaceId, T>>>

export type PieceViewModel =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly piece: PieceDetail
      readonly castToggling: BySurface<string>
      readonly castError: BySurface<string>
      readonly toggleCast: (surface: PieceSurfaceId, memberId: string) => void
      readonly retitling: boolean
      readonly retitleError: string | undefined
      readonly retitle: (title: string) => void
      readonly settingStatus: boolean
      readonly statusError: string | undefined
      readonly setStatus: (status: PieceStatus) => void
      readonly refreshConversations: (surface: PieceSurfaceId) => void
      readonly deletingConversationId: BySurface<string>
      readonly conversationsError: BySurface<string>
      readonly deleteConversation: (surface: PieceSurfaceId, conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
    }
  | { readonly status: 'error'; readonly message: string }

function withSurface<T>(surface: PieceSurfaceId, value: T | undefined): (current: BySurface<T>) => BySurface<T> {
  return (current) => ({ ...current, [surface]: value })
}

export function usePiece(id: string): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id])
  const [state, setState] = useLoaded(load, [id])
  const [castToggling, setCastToggling] = useState<BySurface<string>>({})
  const [castError, setCastError] = useState<BySurface<string>>({})
  const [retitling, setRetitling] = useState(false)
  const [retitleError, setRetitleError] = useState<string | undefined>(undefined)
  const [settingStatus, setSettingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | undefined>(undefined)
  const [deletingConversationId, setDeletingConversationId] = useState<BySurface<string>>({})
  const [conversationsError, setConversationsError] = useState<BySurface<string>>({})

  const toggleCast = useCallback(
    (surface: PieceSurfaceId, memberId: string) => {
      if (state.kind !== 'ready') return
      const piece = state.value
      const cast = piece.surfaces[surface].cast
      const target = cast.find((member) => member.id === memberId)
      if (target === undefined) return

      const nextEnabled = cast.filter((member) => (member.id === memberId ? !member.enabled : member.enabled)).map((member) => member.id)

      setCastToggling(withSurface(surface, memberId))
      setCastError(withSurface<string>(surface, undefined))
      void updatePiece(id, { cast: { surface, ids: nextEnabled } }).then((result) => {
        setCastToggling(withSurface<string>(surface, undefined))
        if (result.outcome === 'value') {
          setState({ kind: 'ready', value: result.value })
          return
        }
        setCastError(withSurface(surface, failureMessage(result)))
      })
    },
    [id, state],
  )

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

  const refreshConversations = useCallback(
    (surface: PieceSurfaceId) => {
      setConversationsError(withSurface<string>(surface, undefined))
      void fetchPiece(id).then((result) => {
        if (result.outcome === 'value') {
          setState({ kind: 'ready', value: result.value })
          return
        }
        setConversationsError(withSurface(surface, failureMessage(result)))
      })
    },
    [id],
  )

  const deleteConversation = useCallback(
    (surface: PieceSurfaceId, conversationId: string): Promise<readonly ConversationSummary[] | undefined> => {
      if (state.kind !== 'ready') return Promise.resolve(undefined)
      const piece = state.value

      setDeletingConversationId(withSurface(surface, conversationId))
      setConversationsError(withSurface<string>(surface, undefined))
      return deleteConversationRequest(id, surface, conversationId).then((result) => {
        setDeletingConversationId(withSurface<string>(surface, undefined))
        if (result.outcome !== 'value') {
          setConversationsError(withSurface(surface, failureMessage(result)))
          return undefined
        }
        const remaining = piece.surfaces[surface].conversations.filter((c) => c.id !== conversationId)
        setState({ kind: 'ready', value: { ...piece, surfaces: { ...piece.surfaces, [surface]: { ...piece.surfaces[surface], conversations: remaining } } } })
        return remaining
      })
    },
    [id, state],
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
    refreshConversations,
    deletingConversationId,
    conversationsError,
    deleteConversation,
  }
}
