import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { SurfaceId } from '../shared/surfaces.js'
import { fetchPiece } from './piecesClient.js'
import { failureMessage } from './request.js'
import { deleteConversation } from './roomClient.js'

export type SurfaceConversationsViewModel = Readonly<{
  listed: readonly ConversationSummary[]
  /** The conversation whose deletion is in flight, so its own row can say so. */
  deletingId: string | undefined
  error: string | undefined
  refresh: () => void
  /** Resolves with what is left to switch to, or nothing at all if the deletion failed. */
  remove: (conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
}>

/**
 * One surface's own conversations: the list it offers to switch between, and deleting one. Every
 * conversation here belongs to this surface's conversation scope, so re-reading the piece takes only
 * this surface's list from it and leaves what another surface is showing alone.
 */
export function useSurfaceConversations(pieceId: string, surface: SurfaceId, initialListed: readonly ConversationSummary[]): SurfaceConversationsViewModel {
  const [listed, setListed] = useState(initialListed)
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const listedRef = useRef(initialListed)
  const deletionRevision = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const inFlight = useRef<AbortController | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      inFlight.current?.abort()
    }
  }, [])

  function install(next: readonly ConversationSummary[]): void {
    listedRef.current = next
    setListed(next)
  }

  const refresh = useCallback(() => {
    setError(undefined)
    queue.current = queue.current.then(async () => {
      if (!mounted.current) return
      const controller = new AbortController()
      inFlight.current = controller
      const result = await fetchPiece(pieceId, controller.signal)
      if (!mounted.current || controller.signal.aborted) return
      inFlight.current = undefined
      if (result.outcome === 'value') {
        install(result.value.surfaces[surface].conversations)
        return
      }
      setError(failureMessage(result))
    })
  }, [pieceId, surface])

  const remove = useCallback(
    (conversationId: string): Promise<readonly ConversationSummary[] | undefined> => {
      const revision = ++deletionRevision.current
      setDeletingId(conversationId)
      setError(undefined)
      let remaining: readonly ConversationSummary[] | undefined
      const operation = queue.current.then(async () => {
        if (!mounted.current) return
        const controller = new AbortController()
        inFlight.current = controller
        const result = await deleteConversation(pieceId, surface, conversationId, controller.signal)
        if (!mounted.current || controller.signal.aborted) return
        inFlight.current = undefined
        if (revision === deletionRevision.current) setDeletingId(undefined)
        if (result.outcome !== 'value') {
          if (revision === deletionRevision.current) setError(failureMessage(result))
          return
        }
        remaining = listedRef.current.filter((conversation) => conversation.id !== conversationId)
        install(remaining)
      })
      queue.current = operation
      return operation.then(() => remaining)
    },
    [pieceId, surface],
  )

  return { listed, deletingId, error, refresh, remove }
}
