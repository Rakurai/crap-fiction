import { useState } from 'react'
import { CallSitesScreen } from './CallSitesScreen.js'
import { NewPieceForm } from './NewPieceForm.js'
import { OpenedPiece } from './OpenedPiece.js'
import { PieceList } from './PieceList.js'
import styles from './PiecesScreen.module.css'
import { ThemeToggle } from './ThemeToggle.js'
import { usePieces } from './usePieces.js'
import { useTheme } from './useTheme.js'

/**
 * PRD "Move on to the next piece"/"Say where the work lives": the screen the
 * studio launches into. Model assignment is a place the author goes from
 * here (UX_DESIGN "Prominence"), alongside the theme, creating, listing and
 * opening pieces.
 */
export function PiecesScreen() {
  const pieces = usePieces()
  const theme = useTheme()
  const [openedId, setOpenedId] = useState<string | undefined>(undefined)
  const [showCallSites, setShowCallSites] = useState(false)

  if (openedId !== undefined) {
    return <OpenedPiece id={openedId} onClose={() => setOpenedId(undefined)} />
  }

  if (showCallSites) {
    return <CallSitesScreen onClose={() => setShowCallSites(false)} />
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <ThemeToggle theme={theme.theme} onChoose={theme.choose} />
        <span className={styles.spacer} />
        <button type="button" className={styles.modelsButton} onClick={() => setShowCallSites(true)}>
          Models
        </button>
      </div>
      <div className={styles.center}>
        <div className={styles.panel}>
          {theme.loadError !== undefined && (
            <p className={styles.error} role="alert">
              {theme.loadError}
            </p>
          )}
          {theme.chooseError !== undefined && (
            <p className={styles.error} role="alert">
              {theme.chooseError}
            </p>
          )}
          <NewPieceForm
            submitting={pieces.status === 'ready' && pieces.creating}
            error={pieces.status === 'ready' ? pieces.createError : undefined}
            onSubmit={(title) => {
              if (pieces.status === 'ready') pieces.create(title)
            }}
          />
          {pieces.status === 'ready' && <PieceList pieces={pieces.pieces} onOpen={setOpenedId} />}
          {pieces.status === 'error' && (
            <p className={styles.error} role="alert">
              {pieces.message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
