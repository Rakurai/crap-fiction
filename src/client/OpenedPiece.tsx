import type { PieceDetail } from '../shared/pieceViews.js'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { Conversation } from './Conversation.js'
import { useLoaded } from './load.js'
import { Manuscript } from './Manuscript.js'
import styles from './OpenedPiece.module.css'
import { saveDraft } from './piecesClient.js'
import { abandonOperation, createConversation, fetchConversation, startRound, subscribeToRoom } from './roomClient.js'
import { useAutosave } from './useAutosave.js'
import { useManuscript } from './useManuscript.js'
import { usePiece } from './usePiece.js'
import { useRoster } from './useRoster.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
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
function Surfaces({ piece, onClose }: { readonly piece: PieceDetail; readonly onClose: () => void }) {
  const manuscript = useManuscript(piece.draft)
  const autosave = useAutosave(piece.id, manuscript.markdown, saveDraft)
  const roster = useRoster(fetchCallSites)
  // Whether the room can be reached is asked here, where the author is working,
  // rather than only on the models screen: it is the composer's notice, and the
  // composer is on this screen.
  const [probe] = useLoaded(fetchRuntimeStatus, [])

  return (
    <div className={styles.row}>
      <Manuscript title={piece.title} mode={piece.mode} onClose={onClose} manuscript={manuscript} autosave={autosave} />
      {manuscript.view !== 'reading' && roster.settled && (
        <Conversation
          pieceId={piece.id}
          currentConversationId={piece.currentConversationId}
          roundInFlight={piece.roundInFlight}
          draft={manuscript.markdown}
          flushDraft={autosave.flush}
          room={{ createConversation, fetchConversation, startRound, subscribeToRoom, abandonOperation }}
          displayName={roster.displayName}
          mark={roster.mark}
          handles={roster.handles}
          runtime={probe.kind === 'ready' ? probe.value : undefined}
          clock={Date.now}
        />
      )}
    </div>
  )
}

export function OpenedPiece({ id, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  if (piece.status === 'ready') return <Surfaces piece={piece.piece} onClose={onClose} />

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
