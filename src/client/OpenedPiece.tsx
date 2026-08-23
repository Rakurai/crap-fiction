import { assignModel, fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { Manuscript } from './Manuscript.js'
import styles from './OpenedPiece.module.css'
import { saveDraft } from './piecesClient.js'
import { createConversation, fetchConversation, startRound, subscribeToRoom } from './roomClient.js'
import { usePiece } from './usePiece.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

/**
 * The composition root for the manuscript's own adapters (CODING_STANDARDS
 * "Dependencies and injection": the composition root is where they are
 * wired) — Manuscript and its subtree receive these rather than importing
 * the modules that perform them.
 */
export function OpenedPiece({ id, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  if (piece.status === 'ready') {
    return (
      <Manuscript
        pieceId={id}
        title={piece.piece.title}
        mode={piece.piece.mode}
        draft={piece.piece.draft}
        currentConversationId={piece.piece.currentConversationId}
        roundInFlight={piece.piece.roundInFlight}
        onClose={onClose}
        saveDraft={saveDraft}
        room={{ createConversation, fetchConversation, startRound, subscribeToRoom }}
        callSites={{ fetchCallSites, fetchRuntimeStatus, assignModel }}
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
