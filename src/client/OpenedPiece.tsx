import { usePiece } from './usePiece.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

/**
 * A tracer-bullet stand-in for the piece opened: the manuscript surface
 * itself is a later ticket's ("The manuscript in three views"). This proves
 * the create-list-open round trip without building ahead of that ticket.
 */
export function OpenedPiece({ id, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  return (
    <div>
      <button type="button" onClick={onClose}>
        ‹ pieces
      </button>
      {piece.status === 'loading' && <p>Opening…</p>}
      {piece.status === 'error' && <p role="alert">{piece.message}</p>}
      {piece.status === 'ready' && <h1>{piece.piece.title}</h1>}
    </div>
  )
}
