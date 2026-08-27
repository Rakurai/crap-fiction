import type { PieceSummary } from '../shared/pieceViews.js'
import { facts, machineWords, whenChanged, wordCount } from './facts.js'
import styles from './PieceList.module.css'

type PieceListProps = {
  readonly pieces: readonly PieceSummary[]
  readonly openedId: string | undefined
  readonly leaveBlocked: boolean
  readonly onOpen: (id: string) => void
}

const OPEN = machineWords('open')

export function PieceList({ pieces, openedId, leaveBlocked, onOpen }: PieceListProps) {
  if (pieces.length === 0) {
    return <p className={styles.empty}>No pieces yet.</p>
  }

  return (
    <ul className={styles.list}>
      {pieces.map((piece) => {
        const isOpen = piece.id === openedId
        return (
          <li key={piece.id} className={styles.item}>
            <button type="button" className={styles.open} onClick={() => onOpen(piece.id)} disabled={!isOpen && leaveBlocked}>
              {piece.title}
            </button>
            {isOpen && <span className={styles.openStamp}>{OPEN}</span>}
            <span className={styles.facts}>{facts(wordCount(piece.length), whenChanged(piece.modified, Date.now))}</span>
          </li>
        )
      })}
    </ul>
  )
}
