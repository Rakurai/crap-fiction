import { useCallback, useRef, useState } from 'react'
import type { PieceDetail } from '../shared/pieceViews.js'
import { SURFACE_IDS, type SurfaceId } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import type { BySurface } from './bySurface.js'
import type { fetchCallSites as fetchCallSitesFn, fetchRuntimeStatus as fetchRuntimeStatusFn } from './callSitesClient.js'
import { closePiece } from './closePiece.js'
import { useDocumentSnapshotRegistry } from './documentSnapshotRegistry.js'
import { EditingSurface, type SurfaceBodyConfig } from './EditingSurface.js'
import { useLoaded } from './load.js'
import styles from './OpenedPiece.module.css'
import type { LifecycleProps } from './pieceLifecycle.js'
import { usePieceStream } from './pieceStream.js'
import { type AuthorContextSelection } from './useConversationSession.js'
import type { RoomAdapters } from './useConversation.js'
import { usePiece, type PieceAdapters } from './usePiece.js'
import { useRoster } from './useRoster.js'

export type { AuthorContextSelection } from './useConversationSession.js'

/** What the studio can be asked about the call sites a piece's chrome reports. */
export type CallSiteAdapters = Readonly<{
  fetchCallSites: typeof fetchCallSitesFn
  fetchRuntimeStatus: typeof fetchRuntimeStatusFn
}>

type OpenedPieceProps = {
  readonly id: string
  readonly pieceAdapters: PieceAdapters
  readonly room: RoomAdapters
  readonly callSites: CallSiteAdapters
  /** Omitted, the author-context conversation selection is local to this mount, same as the other surfaces. */
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onClose: () => void
}

function bodyConfigFor(piece: PieceDetail, surface: SurfaceId): SurfaceBodyConfig {
  if (surface === 'draft') return { kind: 'prose', surface }
  return { kind: 'plainText', surface, referenceSchema: piece.surfaces[surface].referenceSchema }
}

/**
 * The shell over one open piece: piece-level chrome and close, the one event connection every
 * surface observes, and the document-snapshot registry each surface's own text feeds. Everything
 * specific to one surface — its document, its conversation, its cast, its Apply — belongs to the
 * `EditingSurface` mounted for it, not here.
 */
function Surfaces({
  piece,
  lifecycle,
  room,
  pieceAdapters,
  callSites,
  authorContextSelection,
  onClose,
}: {
  readonly piece: PieceDetail
  readonly lifecycle: LifecycleProps
  readonly room: RoomAdapters
  readonly pieceAdapters: PieceAdapters
  readonly callSites: CallSiteAdapters
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onClose: () => void
}) {
  const roster = useRoster(callSites.fetchCallSites)
  const [probe] = useLoaded(callSites.fetchRuntimeStatus, [])
  // One event source for the whole opened piece: every surface's conversation subscribes through
  // this rather than reconnecting the stream when the author switches which surface it shows.
  const pieceStream = usePieceStream(piece.id, room.subscribeToRoom)
  const registry = useDocumentSnapshotRegistry({
    draft: piece.surfaces.draft.text,
    storyContext: piece.surfaces.storyContext.text,
    authorContext: piece.surfaces.authorContext.text,
  })

  const [activeSurface, setActiveSurface] = useState<SurfaceId>('draft')
  const [saveFailed, setSaveFailed] = useState<BySurface<boolean>>({})
  const [closing, setClosing] = useState(false)
  const flushersRef = useRef<BySurface<() => Promise<AutosaveState>>>({})

  // Whether leaving the piece is refused — any surface's own failed save, not only the visible
  // one's — or a close already under way, so a repeated request cannot start a second one.
  const leaveBlocked = closing || SURFACE_IDS.some((surface) => saveFailed[surface] === true)

  // Stable across renders, and shared by every mounted surface, so a surface reporting its own
  // state upward never itself becomes the reason the shell — and every other surface — re-renders.
  const handleSaveFailedChange = useCallback((surface: SurfaceId, failed: boolean) => {
    setSaveFailed((current) => (current[surface] === failed ? current : { ...current, [surface]: failed }))
  }, [])
  const handleFlushRegister = useCallback((surface: SurfaceId, flush: () => Promise<AutosaveState>) => {
    flushersRef.current = { ...flushersRef.current, [surface]: flush }
  }, [])

  // Each surface subscribes through the one connection this shell holds, not its own.
  const surfaceRoom: RoomAdapters = { ...room, subscribeToRoom: pieceStream }

  // Leaving is a coordinated lifecycle rather than an unmount cleanup: every surface's document is
  // flushed and awaited first, because a failed write is the one thing that keeps the piece open.
  // `closing` disables repeated requests and keeps every surface's own persistence status visible
  // for as long as this is waiting.
  async function leave(): Promise<void> {
    if (closing) return
    setClosing(true)
    const result = await closePiece(flushersRef.current)
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
          title={piece.title}
          mode={piece.mode}
          body={bodyConfigFor(piece, surface)}
          initialText={piece.surfaces[surface].text}
          initialConversationId={piece.surfaces[surface].currentConversationId}
          conversationSelection={surface === 'authorContext' ? authorContextSelection : undefined}
          initialCast={piece.surfaces[surface].cast}
          initialConversations={piece.surfaces[surface].conversations}
          storyEditor={piece.storyEditor}
          interviewer={piece.interviewer}
          room={surfaceRoom}
          pieceAdapters={pieceAdapters}
          roster={roster}
          runtime={probe.kind === 'ready' ? probe.value : undefined}
          lifecycle={lifecycle}
          active={activeSurface === surface}
          onSwitchToSurface={setActiveSurface}
          leaveBlocked={leaveBlocked}
          onClose={() => void leave()}
          onTextChange={registry.update}
          onSaveFailedChange={handleSaveFailedChange}
          onFlushRegister={handleFlushRegister}
          documents={registry.documents}
        />
      ))}
    </div>
  )
}

export function OpenedPiece({ id, pieceAdapters, room, callSites, authorContextSelection, onClose }: OpenedPieceProps) {
  const piece = usePiece(id, pieceAdapters)

  if (piece.status === 'ready') {
    return (
      <Surfaces
        piece={piece.piece}
        room={room}
        pieceAdapters={pieceAdapters}
        callSites={callSites}
        lifecycle={{
          retitling: piece.retitling,
          retitleError: piece.retitleError,
          onRetitle: piece.retitle,
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
