import { useCallback, useState } from 'react'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { OpenedPiece, type CallSiteAdapters } from './OpenedPiece.js'
import { fetchPiece, saveSurfaceDocument, updatePiece } from './piecesClient.js'
import { PiecesWindow } from './PiecesWindow.js'
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
import styles from './Studio.module.css'
import type { RoomAdapters } from './useConversation.js'
import type { PieceAdapters } from './usePiece.js'
import { usePieces } from './usePieces.js'
import { useTheme } from './useTheme.js'

type StudioProps = {
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

/**
 * The studio pair — the document and its conversation — is the only thing this ever renders in
 * place of another: no piece open draws both panes empty, and the pieces window arrives over
 * whichever of those is current, on its own ground, leaving without disturbing either.
 */
export function Studio({ workspace }: StudioProps) {
  useTheme()
  const [openedId, setOpenedId] = useState<string | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const pieces = usePieces(refreshKey)
  const [showPieces, setShowPieces] = useState(true)
  const [switchTargetId, setSwitchTargetId] = useState<string | undefined>(undefined)
  const [leaveBlocked, setLeaveBlocked] = useState(false)
  // Outlives any one opened piece, so the author-context conversation the author is in stays
  // selected across a piece switch. `undefined` until the author has picked one this session —
  // until then, each opened piece falls back to whichever global conversation it last opened with.
  const [authorContextConversationId, setAuthorContextConversationId] = useState<string | null | undefined>(undefined)

  const openPieces = useCallback(() => {
    setShowPieces(true)
    setRefreshKey((key) => key + 1)
  }, [])

  function handleSwitchSettled(blocked: boolean): void {
    if (!blocked && switchTargetId !== undefined) {
      setOpenedId(switchTargetId)
      setShowPieces(false)
      setRefreshKey((key) => key + 1)
    }
    setSwitchTargetId(undefined)
  }

  function openPiece(id: string): void {
    if (id === openedId) {
      setShowPieces(false)
      return
    }
    if (openedId === undefined) {
      setOpenedId(id)
      setShowPieces(false)
      return
    }
    setSwitchTargetId(id)
  }

  return (
    <div className={styles.studio}>
      {openedId === undefined ? (
        <div className={styles.pair}>
          <div className={styles.documentPane} />
          <div className={styles.conversationPane} />
        </div>
      ) : (
        <OpenedPiece
          id={openedId}
          pieceAdapters={PIECE_ADAPTERS}
          room={ROOM_ADAPTERS}
          callSites={CALL_SITE_ADAPTERS}
          authorContextSelection={{ value: authorContextConversationId, onChange: setAuthorContextConversationId }}
          onOpenPieces={openPieces}
          onLeaveBlockedChange={setLeaveBlocked}
          switchRequest={{ targetId: switchTargetId, onSettled: handleSwitchSettled }}
        />
      )}
      {showPieces && (
        <PiecesWindow
          workspace={workspace}
          pieces={pieces}
          openedId={openedId}
          leaveBlocked={leaveBlocked}
          onOpen={openPiece}
          onClose={() => setShowPieces(false)}
        />
      )}
    </div>
  )
}
