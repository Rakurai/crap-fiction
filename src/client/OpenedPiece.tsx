import { useState } from 'react'
import type { CastMemberView, PieceDetail, PieceStatus } from '../shared/pieceViews.js'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { Conversation } from './Conversation.js'
import { useLoaded } from './load.js'
import { Manuscript } from './Manuscript.js'
import styles from './OpenedPiece.module.css'
import { saveDraft } from './piecesClient.js'
import { RoomEditor } from './RoomEditor.js'
import { abandonOperation, applyRecommendation, createConversation, fetchConversation, startRound, subscribeToRoom } from './roomClient.js'
import { useAutosave } from './useAutosave.js'
import { useManuscript } from './useManuscript.js'
import { usePiece } from './usePiece.js'
import { useRoster } from './useRoster.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

type RoomProps = {
  readonly cast: readonly CastMemberView[]
  readonly toggling: string | undefined
  readonly error: string | undefined
  readonly onToggle: (id: string) => void
}

/** #19 "Piece lifecycle": retitling and marking a piece finished or abandoned, bundled the same way `RoomProps` bundles the cast toggle. */
type LifecycleProps = {
  readonly status: PieceStatus
  readonly retitling: boolean
  readonly retitleError: string | undefined
  readonly onRetitle: (title: string) => void
  readonly settingStatus: boolean
  readonly statusError: string | undefined
  readonly onSetStatus: (status: PieceStatus) => void
}

/**
 * UX_DESIGN "Design thesis": two surfaces are always present, the prose and the
 * conversation about it. This is the one place that knows they are two — it owns
 * the manuscript's text and its autosave, which both surfaces need, and it is
 * where each surface's adapters are wired (CODING_STANDARDS "Dependencies and
 * injection": the composition root is where they are wired). Neither surface
 * imports what the other performs, and neither carries the other's
 * collaborators through as props it never uses.
 *
 * The prose renders as soon as the piece is read; the conversation waits for the
 * room's names. That order is the priority UX_DESIGN states — prose first — and
 * it is what keeps a participant from being drawn under its internal id for the
 * moment before the roster lands.
 */
function Surfaces({
  piece,
  room,
  lifecycle,
  onClose,
}: {
  readonly piece: PieceDetail
  readonly room: RoomProps
  readonly lifecycle: LifecycleProps
  readonly onClose: () => void
}) {
  const manuscript = useManuscript(piece.draft)
  const autosave = useAutosave(piece.id, manuscript.markdown, saveDraft)
  const roster = useRoster(fetchCallSites)
  // Whether the room can be reached is asked here, where the author is working,
  // rather than only on the models screen: it is the composer's notice, and the
  // composer is on this screen.
  const [probe] = useLoaded(fetchRuntimeStatus, [])
  // UX_DESIGN "Prominence": editing the room owns no permanent space — it
  // arrives on the one action that reaches it and leaves on the one that
  // closes it.
  const [roomOpen, setRoomOpen] = useState(false)
  // SPEC "Applying a recommendation": the manuscript's own read-only lock,
  // held for exactly the duration of the call — a fact `Conversation` learns
  // first, since applying is one of the actions a response offers, and
  // mirrored here because `Manuscript` is the surface the lock is drawn on.
  const [applying, setApplying] = useState(false)

  return (
    <div className={styles.row}>
      <Manuscript
        title={piece.title}
        mode={piece.mode}
        onClose={onClose}
        manuscript={manuscript}
        autosave={autosave}
        onOpenRoom={() => setRoomOpen(true)}
        lifecycle={lifecycle}
        applying={applying}
      />
      {manuscript.view !== 'reading' && roster.settled && (
        <Conversation
          pieceId={piece.id}
          currentConversationId={piece.currentConversationId}
          roundInFlight={piece.roundInFlight}
          draft={manuscript.markdown}
          flushDraft={autosave.flush}
          room={{ createConversation, fetchConversation, startRound, subscribeToRoom, abandonOperation, applyRecommendation }}
          displayName={roster.displayName}
          mark={roster.mark}
          handles={roster.handles}
          runtime={probe.kind === 'ready' ? probe.value : undefined}
          clock={Date.now}
          onApplied={manuscript.applyRecommendation}
          onApplyingChange={setApplying}
        />
      )}
      {roomOpen && (
        <RoomEditor members={room.cast} toggling={room.toggling} onToggle={room.onToggle} onClose={() => setRoomOpen(false)} />
      )}
      {room.error !== undefined && (
        <p className={styles.error} role="alert">
          {room.error}
        </p>
      )}
    </div>
  )
}

export function OpenedPiece({ id, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  /**
   * SPEC "Substrate": switching pieces abandons whatever operation is in
   * flight, which keeps whatever landed. Asked unconditionally — the room's
   * own abandon is a legitimate no-op when nothing was running (SPEC
   * "Seams") — rather than this surface tracking whether one was, which
   * would be inventing a fact the room already owns.
   */
  function leave(): void {
    void abandonOperation(id)
    onClose()
  }

  if (piece.status === 'ready') {
    return (
      <Surfaces
        piece={piece.piece}
        room={{ cast: piece.piece.cast, toggling: piece.castToggling, error: piece.castError, onToggle: piece.toggleCast }}
        lifecycle={{
          status: piece.piece.status,
          retitling: piece.retitling,
          retitleError: piece.retitleError,
          onRetitle: piece.retitle,
          settingStatus: piece.settingStatus,
          statusError: piece.statusError,
          onSetStatus: piece.setStatus,
        }}
        onClose={leave}
      />
    )
  }

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.back} onClick={leave}>
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
