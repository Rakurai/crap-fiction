import { Manuscript } from './Manuscript.js'
import styles from './OpenedPiece.module.css'
import { usePiece } from './usePiece.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

export function OpenedPiece({ id, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  if (piece.status === 'ready') {
    return (
      <Manuscript
        pieceId={id}
        title={piece.piece.title}
        mode={piece.piece.mode}
        draft={piece.piece.draft}
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
