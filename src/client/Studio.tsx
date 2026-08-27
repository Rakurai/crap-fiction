import { useCallback, useState } from 'react'
import { assignModel, fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { EmptyPair } from './EmptyPair.js'
import { ModelsWindow } from './ModelsWindow.js'
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
import { useCallSites } from './useCallSites.js'
import type { RoomAdapters } from './useConversation.js'
import type { PieceAdapters } from './usePiece.js'
import { usePieces } from './usePieces.js'
import { useTheme } from './useTheme.js'

type StudioProps = {
  readonly workspace: string
}

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

export function Studio({ workspace }: StudioProps) {
  const theme = useTheme()
  const callSites = useCallSites({ fetchCallSites, fetchRuntimeStatus, assignModel })
  const [openedId, setOpenedId] = useState<string | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const pieces = usePieces(refreshKey)
  const [showPieces, setShowPieces] = useState(true)
  const [showModels, setShowModels] = useState(false)
  const [switchTargetId, setSwitchTargetId] = useState<string | undefined>(undefined)
  const [leaveBlocked, setLeaveBlocked] = useState(false)
  const [authorContextConversationId, setAuthorContextConversationId] = useState<string | null | undefined>(undefined)

  const openPieces = useCallback(() => {
    setShowPieces(true)
    setRefreshKey((key) => key + 1)
  }, [])

  const openModels = useCallback(() => setShowModels(true), [])

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
        <EmptyPair state={{ kind: 'empty' }} />
      ) : (
        <OpenedPiece
          id={openedId}
          pieceAdapters={PIECE_ADAPTERS}
          room={ROOM_ADAPTERS}
          callSites={CALL_SITE_ADAPTERS}
          authorContextSelection={{ value: authorContextConversationId, onChange: setAuthorContextConversationId }}
          onOpenPieces={openPieces}
          onOpenModels={openModels}
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
      {showModels && <ModelsWindow callSites={callSites} theme={theme} onClose={() => setShowModels(false)} />}
    </div>
  )
}
