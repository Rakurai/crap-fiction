import { useState } from 'react'
import { CallSitesScreen } from './CallSitesScreen.js'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { NewPieceForm, offeredModes } from './NewPieceForm.js'
import { OpenedPiece, type CallSiteAdapters } from './OpenedPiece.js'
import { PieceList } from './PieceList.js'
import { fetchPiece, saveSurfaceDocument, updatePiece } from './piecesClient.js'
import styles from './PiecesScreen.module.css'
import {
  abandonOperation,
  applyRecommendation,
  confirmApplication,
  createConversation,
  dispatch,
  fetchConversation,
  retrievePendingApply,
  subscribeToRoom,
} from './roomClient.js'
import { ThemeToggle } from './ThemeToggle.js'
import type { RoomAdapters } from './useConversation.js'
import type { PieceAdapters } from './usePiece.js'
import { usePieces } from './usePieces.js'
import { useTheme } from './useTheme.js'

type PiecesScreenProps = {
  readonly workspace: string
}

// The studio's own transports, wired where the piece the author opened is chosen, so nothing
// inside an open piece reaches for one itself.
const PIECE_ADAPTERS: PieceAdapters = { fetchPiece, updatePiece }
const CALL_SITE_ADAPTERS: CallSiteAdapters = { fetchCallSites, fetchRuntimeStatus }
const ROOM_ADAPTERS: RoomAdapters = {
  createConversation,
  fetchConversation,
  dispatch,
  subscribeToRoom,
  abandonOperation,
  applyRecommendation,
  confirmApplication,
  retrievePendingApply,
  saveDocument: saveSurfaceDocument,
}

export function PiecesScreen({ workspace }: PiecesScreenProps) {
  const [openedId, setOpenedId] = useState<string | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const pieces = usePieces(refreshKey)
  const theme = useTheme()
  const [showCallSites, setShowCallSites] = useState(false)
  // Outlives any one opened piece, so the author-context conversation the author is in stays
  // selected across a piece switch. `undefined` until the author has picked one this session —
  // until then, each opened piece falls back to whichever global conversation it last opened with.
  const [authorContextConversationId, setAuthorContextConversationId] = useState<string | null | undefined>(undefined)
  const modes = pieces.status === 'ready' ? offeredModes(pieces.modes) : undefined

  if (openedId !== undefined) {
    return (
      <OpenedPiece
        id={openedId}
        pieceAdapters={PIECE_ADAPTERS}
        room={ROOM_ADAPTERS}
        callSites={CALL_SITE_ADAPTERS}
        authorContextSelection={{ value: authorContextConversationId, onChange: setAuthorContextConversationId }}
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
          {/* The one screen that precedes any open piece is the one that says what this is. */}
          <h1 className={styles.name}>crap fiction</h1>
          <p className={styles.what}>A studio for writing fiction with a room of specialized collaborators.</p>
          {pieces.status === 'ready' && <PieceList pieces={pieces.pieces} onOpen={setOpenedId} />}
          {pieces.status === 'error' && (
            <p className={styles.error} role="alert">
              {pieces.message}
            </p>
          )}
          {/* A listing that failed carries no mode to create in, and a create control that cannot
              create is worse than an absent one, so the form is absent until there is one. */}
          {pieces.status === 'ready' && modes !== undefined && (
            <div className={styles.creating}>
              <NewPieceForm
                submitting={pieces.creating}
                error={pieces.createError}
                modes={modes}
                onSubmit={pieces.create}
              />
            </div>
          )}
          <p className={styles.workspace} title={workspace}>
            {workspace}
          </p>
        </div>
      </div>
    </div>
  )
}
