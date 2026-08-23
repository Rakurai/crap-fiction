import type { PieceSummary } from '../server/pieces.js'
import styles from './PieceList.module.css'

type PieceListProps = {
  readonly pieces: readonly PieceSummary[]
  readonly onOpen: (id: string) => void
}

export function PieceList({ pieces, onOpen }: PieceListProps) {
  if (pieces.length === 0) {
    return <p className={styles.empty}>No pieces yet.</p>
  }

  return (
    <ul className={styles.list}>
      {pieces.map((piece) => (
        <li key={piece.id} className={styles.item}>
          <button type="button" className={styles.open} onClick={() => onOpen(piece.id)}>
            {piece.title}
          </button>
          <span className={styles.facts}>
            {piece.length} words · {new Date(piece.modified).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  )
}
