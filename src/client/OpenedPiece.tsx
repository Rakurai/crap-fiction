import { useCallback, useRef, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { PieceDetail } from '../shared/pieceViews.js'
import { SURFACE_IDS, type SurfaceId } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import { type BySurface, withSurface } from './bySurface.js'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { closePiece } from './closePiece.js'
import { documentSnapshotFrom } from './documentSnapshot.js'
import { useDocumentSnapshotRegistry } from './documentSnapshotRegistry.js'
import { EditingSurface, type SurfaceBodyConfig } from './EditingSurface.js'
import { useLoaded } from './load.js'
import styles from './OpenedPiece.module.css'
import type { LifecycleProps } from './pieceLifecycle.js'
import { saveSurfaceDocument } from './piecesClient.js'
import { usePieceStream } from './pieceStream.js'
import {
  abandonOperation,
  applyRecommendation,
  confirmApplication,
  createConversation,
  dispatch,
  fetchConversation,
  subscribeToRoom,
} from './roomClient.js'
import { type AuthorContextSelection, type LiveAction } from './useConversationSession.js'
import { usePiece } from './usePiece.js'
import { useRoster } from './useRoster.js'

export type { AuthorContextSelection } from './useConversationSession.js'

type OpenedPieceProps = {
  readonly id: string
  /** Omitted, the author-context conversation selection is local to this mount, same as the other surfaces. */
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onClose: () => void
}

type RoomProps = {
  readonly toggling: BySurface<string>
  readonly error: BySurface<string>
  readonly onToggle: (surface: SurfaceId, memberId: string) => void
}

type ConversationsProps = {
  readonly onRefresh: (surface: SurfaceId) => void
  readonly deletingId: BySurface<string>
  readonly error: BySurface<string>
  readonly onDelete: (surface: SurfaceId, conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
}

function bodyConfigFor(piece: PieceDetail, surface: SurfaceId): SurfaceBodyConfig {
  return surface === 'draft' ? { kind: 'prose' } : { kind: 'plainText', referenceSchema: piece.surfaces[surface].referenceSchema }
}

/**
 * The shell over one open piece: piece-level chrome and close, the one event connection every
 * surface observes, and the document-snapshot registry each surface's own text feeds. Everything
 * specific to one surface — its document, its conversation, its cast controls, its Apply — belongs
 * to the `EditingSurface` mounted for it, not here.
 */
function Surfaces({
  piece,
  room,
  lifecycle,
  conversations,
  authorContextSelection,
  onClose,
}: {
  readonly piece: PieceDetail
  readonly room: RoomProps
  readonly lifecycle: LifecycleProps
  readonly conversations: ConversationsProps
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onClose: () => void
}) {
  const roster = useRoster(fetchCallSites)
  const [probe] = useLoaded(fetchRuntimeStatus, [])
  // One event source for the whole opened piece: every surface's conversation subscribes through
  // this rather than reconnecting the stream when the author switches which surface it shows.
  const pieceStream = usePieceStream(piece.id, subscribeToRoom)
  const registry = useDocumentSnapshotRegistry(
    documentSnapshotFrom(piece.surfaces.draft.text, piece.surfaces.storyContext.text, piece.surfaces.authorContext.text),
  )

  const [activeSurface, setActiveSurface] = useState<SurfaceId>('draft')
  const [saveFailed, setSaveFailed] = useState<BySurface<boolean>>({})
  const [liveActions, setLiveActions] = useState<BySurface<LiveAction>>({})
  const [closing, setClosing] = useState(false)
  // A plain ref rather than state: every mounted surface's flush is registered once and never
  // drawn from, so re-rendering the shell whenever one changed identity would buy nothing.
  const flushersRef = useRef<BySurface<() => Promise<AutosaveState>>>({})

  // Whether leaving the piece is refused — any surface's own failed save, not only the visible
  // one's — or a close already under way, so a repeated request cannot start a second one.
  const leaveBlocked = closing || SURFACE_IDS.some((surface) => saveFailed[surface] === true)

  // Stable across renders, and shared by every mounted surface, so a surface reporting its own
  // state upward never itself becomes the reason the shell — and every other surface — re-renders.
  const handleSaveFailedChange = useCallback((surface: SurfaceId, failed: boolean) => {
    setSaveFailed((current) => (current[surface] === failed ? current : withSurface(surface, failed)(current)))
  }, [])
  const handleLiveActionChange = useCallback((surface: SurfaceId, action: LiveAction | undefined) => {
    setLiveActions((current) => (current[surface] === action ? current : withSurface(surface, action)(current)))
  }, [])
  const handleFlushRegister = useCallback((surface: SurfaceId, flush: () => Promise<AutosaveState>) => {
    flushersRef.current = withSurface(surface, flush)(flushersRef.current)
  }, [])

  const roomAdapters = {
    createConversation,
    fetchConversation,
    dispatch,
    subscribeToRoom: pieceStream,
    abandonOperation,
    applyRecommendation,
    confirmApplication,
    saveDocument: saveSurfaceDocument,
  }

  // Leaving is a coordinated lifecycle rather than an unmount cleanup: every surface's document is
  // flushed and awaited first, because a failed write is the one thing that keeps the piece open,
  // and only once persistence has durably settled does closing own abandoning what each surface
  // still has in flight. `closing` disables repeated requests and keeps every surface's own
  // persistence status visible for as long as this is waiting.
  async function closeAndAbandon(): Promise<void> {
    if (closing) return
    setClosing(true)
    const result = await closePiece(piece.id, flushersRef.current, liveActions, abandonOperation)
    if (result.blocked) {
      setClosing(false)
      return
    }
    onClose()
  }

  return (
    <div className={styles.row}>
      {SURFACE_IDS.map((surface) => (
        <EditingSurface
          key={surface}
          pieceId={piece.id}
          surface={surface}
          title={piece.title}
          mode={piece.mode}
          body={bodyConfigFor(piece, surface)}
          initialText={piece.surfaces[surface].text}
          initialConversationId={piece.surfaces[surface].currentConversationId}
          conversationSelection={surface === 'authorContext' ? authorContextSelection : undefined}
          cast={piece.surfaces[surface].cast}
          conversations={piece.surfaces[surface].conversations}
          storyEditor={piece.storyEditor}
          room={roomAdapters}
          roster={roster}
          runtime={probe.kind === 'ready' ? probe.value : undefined}
          lifecycle={lifecycle}
          active={activeSurface === surface}
          onSwitchToSurface={setActiveSurface}
          leaveBlocked={leaveBlocked}
          onClose={() => void closeAndAbandon()}
          onTextChange={registry.update}
          onSaveFailedChange={handleSaveFailedChange}
          onLiveActionChange={handleLiveActionChange}
          onFlushRegister={handleFlushRegister}
          documents={registry.documents}
          castToggling={room.toggling[surface]}
          castError={room.error[surface]}
          onToggleCast={(memberId) => room.onToggle(surface, memberId)}
          deletingConversationId={conversations.deletingId[surface]}
          conversationsError={conversations.error[surface]}
          onDeleteConversation={(conversationId) => conversations.onDelete(surface, conversationId)}
          onRefreshConversations={() => conversations.onRefresh(surface)}
        />
      ))}
    </div>
  )
}

export function OpenedPiece({ id, authorContextSelection, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  if (piece.status === 'ready') {
    return (
      <Surfaces
        piece={piece.piece}
        room={{
          toggling: piece.castToggling,
          error: piece.castError,
          onToggle: piece.toggleCast,
        }}
        lifecycle={{
          status: piece.piece.status,
          retitling: piece.retitling,
          retitleError: piece.retitleError,
          onRetitle: piece.retitle,
          settingStatus: piece.settingStatus,
          statusError: piece.statusError,
          onSetStatus: piece.setStatus,
        }}
        conversations={{
          onRefresh: piece.refreshConversations,
          deletingId: piece.deletingConversationId,
          error: piece.conversationsError,
          onDelete: piece.deleteConversation,
        }}
        authorContextSelection={authorContextSelection}
        onClose={onClose}
      />
    )
  }

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.back} onClick={onClose}>
        ‹ pieces
      </button>
      {piece.status === 'loading' && <p className={styles.status}>Opening…</p>}
      {piece.status === 'error' && (
        <p className={styles.error} role="alert">
          {piece.message}
        </p>
      )}
    </div>
  )
}
