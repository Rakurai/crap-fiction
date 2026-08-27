import { useCallback, useRef, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { SurfaceId } from '../shared/surfaces.js'
import { fetchPiece } from './piecesClient.js'
import { failureMessage } from './request.js'
import { deleteConversation } from './roomClient.js'
import { useWriteSerializer } from './useWriteSerializer.js'

export type SurfaceConversationsViewModel = Readonly<{
  listed: readonly ConversationSummary[]
  deletingId: string | undefined
  error: string | undefined
  refresh: () => void
  remove: (conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
}>

export function useSurfaceConversations(pieceId: string, surface: SurfaceId, initialListed: readonly ConversationSummary[]): SurfaceConversationsViewModel {
  const [listed, setListed] = useState(initialListed)
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const listedRef = useRef(initialListed)
  const serializer = useWriteSerializer()

  function install(next: readonly ConversationSummary[]): void {
    listedRef.current = next
    setListed(next)
  }

  const refresh = useCallback(() => {
    setError(undefined)
    void serializer.run((signal) => fetchPiece(pieceId, signal)).then((result) => {
      if (result === undefined) return
      if (result.outcome === 'value') {
        install(result.value.surfaces[surface].conversations)
        return
      }
      setError(failureMessage(result))
    })
  }, [pieceId, surface, serializer])

  const remove = useCallback(
    (conversationId: string): Promise<readonly ConversationSummary[] | undefined> => {
      const revision = serializer.nextRevision()
      setDeletingId(conversationId)
      setError(undefined)
      return serializer.run((signal) => deleteConversation(pieceId, surface, conversationId, signal)).then((result) => {
        if (result === undefined) return undefined
        if (serializer.isCurrent(revision)) setDeletingId(undefined)
        if (result.outcome !== 'value') {
          if (serializer.isCurrent(revision)) setError(failureMessage(result))
          return undefined
        }
        const remaining = listedRef.current.filter((conversation) => conversation.id !== conversationId)
        install(remaining)
        return remaining
      })
    },
    [pieceId, surface, serializer],
  )

  return { listed, deletingId, error, refresh, remove }
}
