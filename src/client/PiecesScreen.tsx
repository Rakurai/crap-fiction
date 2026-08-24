import { useState } from 'react'
import { CallSitesScreen } from './CallSitesScreen.js'
import { NewPieceForm } from './NewPieceForm.js'
import { OpenedPiece } from './OpenedPiece.js'
import { PieceList } from './PieceList.js'
import styles from './PiecesScreen.module.css'
import { ThemeToggle } from './ThemeToggle.js'
import { usePieces } from './usePieces.js'
import { useTheme } from './useTheme.js'

type PiecesScreenProps = {
  readonly workspace: string
}

export function PiecesScreen({ workspace }: PiecesScreenProps) {
  const [openedId, setOpenedId] = useState<string | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const pieces = usePieces(refreshKey)
  const theme = useTheme()
  const [showCallSites, setShowCallSites] = useState(false)

  if (openedId !== undefined) {
    return (
      <OpenedPiece
        id={openedId}
        onClose={() => {
          setOpenedId(undefined)
          setRefreshKey((key) => key + 1)
        }}
      />
    )
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
          models
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
          <p className={styles.workspace}>{workspace}</p>
          {pieces.status === 'ready' && <PieceList pieces={pieces.pieces} onOpen={setOpenedId} />}
          {pieces.status === 'error' && (
            <p className={styles.error} role="alert">
              {pieces.message}
            </p>
          )}
          <div className={styles.creating}>
            <NewPieceForm
              submitting={pieces.status === 'ready' && pieces.creating}
              error={pieces.status === 'ready' ? pieces.createError : undefined}
              onSubmit={(title) => {
                if (pieces.status === 'ready') pieces.create(title)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
