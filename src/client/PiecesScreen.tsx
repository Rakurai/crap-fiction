import { useState } from 'react'
import { NewPieceForm } from './NewPieceForm.js'
import { OpenedPiece } from './OpenedPiece.js'
import { PieceList } from './PieceList.js'
import { ThemeToggle } from './ThemeToggle.js'
import { usePieces } from './usePieces.js'
import { useTheme } from './useTheme.js'

/**
 * PRD "Move on to the next piece"/"Say where the work lives": the screen the
 * studio launches into. Model assignment is a later ticket's home; the
 * theme is this one's, alongside creating, listing and opening pieces.
 */
export function PiecesScreen() {
  const pieces = usePieces()
  const theme = useTheme()
  const [openedId, setOpenedId] = useState<string | undefined>(undefined)

  if (openedId !== undefined) {
    return <OpenedPiece id={openedId} onClose={() => setOpenedId(undefined)} />
  }

  return (
    <div>
      <ThemeToggle theme={theme.theme} onChoose={theme.choose} />
      <NewPieceForm
        submitting={pieces.status === 'ready' && pieces.creating}
        error={pieces.status === 'ready' ? pieces.createError : undefined}
        onSubmit={(title) => {
          if (pieces.status === 'ready') pieces.create(title)
        }}
      />
      {pieces.status === 'ready' && <PieceList pieces={pieces.pieces} onOpen={setOpenedId} />}
    </div>
  )
}
