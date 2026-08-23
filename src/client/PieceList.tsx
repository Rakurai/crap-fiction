import type { PieceSummary } from '../server/pieces.js'

type PieceListProps = {
  readonly pieces: readonly PieceSummary[]
  readonly onOpen: (id: string) => void
}

/** Deliberately bare markup (see WorkspacePrompt). */
export function PieceList({ pieces, onOpen }: PieceListProps) {
  if (pieces.length === 0) {
    return <p>No pieces yet.</p>
  }

  return (
    <ul>
      {pieces.map((piece) => (
        <li key={piece.id}>
          <button type="button" onClick={() => onOpen(piece.id)}>
            {piece.title}
          </button>{' '}
          <span>{piece.length} words</span> <span>{new Date(piece.modified).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}
