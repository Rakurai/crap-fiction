import { useCallback, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { PieceDetail, PieceStatus } from '../shared/pieceViews.js'
import { useLoaded } from './load.js'
import { fetchPiece, updatePiece } from './piecesClient.js'
import { failureMessage } from './request.js'
import { deleteConversation as deleteConversationRequest } from './roomClient.js'

export type PieceViewModel =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly piece: PieceDetail
      readonly castToggling: string | undefined
      readonly castError: string | undefined
      readonly toggleCast: (memberId: string) => void
      readonly retitling: boolean
      readonly retitleError: string | undefined
      readonly retitle: (title: string) => void
      readonly settingStatus: boolean
      readonly statusError: string | undefined
      readonly setStatus: (status: PieceStatus) => void
      readonly refreshConversations: () => void
      readonly deletingConversationId: string | undefined
      readonly conversationsError: string | undefined
      readonly deleteConversation: (conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
    }
  | { readonly status: 'error'; readonly message: string }

export function usePiece(id: string): PieceViewModel {
  const load = useCallback((signal: AbortSignal) => fetchPiece(id, signal), [id])
  const [state, setState] = useLoaded(load, [id])
  const [castToggling, setCastToggling] = useState<string | undefined>(undefined)
  const [castError, setCastError] = useState<string | undefined>(undefined)
  const [retitling, setRetitling] = useState(false)
  const [retitleError, setRetitleError] = useState<string | undefined>(undefined)
  const [settingStatus, setSettingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | undefined>(undefined)
  const [deletingConversationId, setDeletingConversationId] = useState<string | undefined>(undefined)
  const [conversationsError, setConversationsError] = useState<string | undefined>(undefined)

  const toggleCast = useCallback(
    (memberId: string) => {
      if (state.kind !== 'ready') return
      const piece = state.value
      const target = piece.surfaces.draft.cast.find((member) => member.id === memberId)
      if (target === undefined) return

      const nextEnabled = piece.surfaces.draft.cast
        .filter((member) => (member.id === memberId ? !member.enabled : member.enabled))
        .map((member) => member.id)

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

  const refreshConversations = useCallback(() => {
    setConversationsError(undefined)
    void fetchPiece(id).then((result) => {
      if (result.outcome === 'value') {
        setState({ kind: 'ready', value: result.value })
        return
      }
      setConversationsError(failureMessage(result))
    })
  }, [id])

  const deleteConversation = useCallback(
    (conversationId: string): Promise<readonly ConversationSummary[] | undefined> => {
      if (state.kind !== 'ready') return Promise.resolve(undefined)
      const piece = state.value

      setDeletingConversationId(conversationId)
      setConversationsError(undefined)
      return deleteConversationRequest(id, conversationId).then((result) => {
        setDeletingConversationId(undefined)
        if (result.outcome !== 'value') {
          setConversationsError(failureMessage(result))
          return undefined
        }
        const remaining = piece.surfaces.draft.conversations.filter((c) => c.id !== conversationId)
        setState({ kind: 'ready', value: { ...piece, surfaces: { ...piece.surfaces, draft: { ...piece.surfaces.draft, conversations: remaining } } } })
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
