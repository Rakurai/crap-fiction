import { Manuscript } from './Manuscript.js'
import { usePiece } from './usePiece.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

export function OpenedPiece({ id, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  if (piece.status === 'ready') {
    return <Manuscript title={piece.piece.title} draft={piece.piece.draft} onClose={onClose} />
  }

  return (
    <div>
      <button type="button" onClick={onClose}>
        ‹ pieces
      </button>
      {piece.status === 'loading' && <p>Opening…</p>}
      {piece.status === 'error' && <p role="alert">{piece.message}</p>}
    </div>
  )
}
