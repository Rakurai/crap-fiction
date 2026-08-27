import { useCallback, useEffect, useRef, useState } from 'react'
import type { PieceDetail } from '../shared/pieceViews.js'
import { SURFACE_IDS, type SurfaceId } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import type { BySurface } from './bySurface.js'
import type { fetchCallSites as fetchCallSitesFn, fetchRuntimeStatus as fetchRuntimeStatusFn } from './callSitesClient.js'
import { closePiece } from './closePiece.js'
import { useDocumentSnapshotRegistry } from './documentSnapshotRegistry.js'
import { EditingSurface, type SurfaceBodyConfig } from './EditingSurface.js'
import { EmptyPair } from './EmptyPair.js'
import { useLoaded } from './load.js'
import styles from './OpenedPiece.module.css'
import type { LifecycleProps } from './pieceLifecycle.js'
import { usePieceStream } from './pieceStream.js'
import { type AuthorContextSelection } from './useConversationSession.js'
import type { RoomAdapters } from './useConversation.js'
import { usePiece, type PieceAdapters } from './usePiece.js'
import { useRoster } from './useRoster.js'

export type { AuthorContextSelection } from './useConversationSession.js'

export type CallSiteAdapters = Readonly<{
  fetchCallSites: typeof fetchCallSitesFn
  fetchRuntimeStatus: typeof fetchRuntimeStatusFn
}>

export type PieceSwitchRequest = Readonly<{
  targetId: string | undefined
  onSettled: (blocked: boolean) => void
}>

type OpenedPieceProps = {
  readonly id: string
  readonly namesMode: boolean
  readonly pieceAdapters: PieceAdapters
  readonly room: RoomAdapters
  readonly callSites: CallSiteAdapters
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onOpenPieces: () => void
  readonly onOpenModels: () => void
  readonly onLeaveBlockedChange: (blocked: boolean) => void
  readonly switchRequest: PieceSwitchRequest
}

function bodyConfigFor(piece: PieceDetail, surface: SurfaceId): SurfaceBodyConfig {
  if (surface === 'draft') return { kind: 'prose', surface, location: piece.surfaces[surface].location }
  return { kind: 'plainText', surface, location: piece.surfaces[surface].location, referenceSchema: piece.surfaces[surface].referenceSchema }
}

function Surfaces({
  piece,
  namesMode,
  lifecycle,
  room,
  pieceAdapters,
  callSites,
  authorContextSelection,
  onOpenPieces,
  onOpenModels,
  onLeaveBlockedChange,
  switchRequest,
}: {
  readonly piece: PieceDetail
  readonly namesMode: boolean
  readonly lifecycle: LifecycleProps
  readonly room: RoomAdapters
  readonly pieceAdapters: PieceAdapters
  readonly callSites: CallSiteAdapters
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onOpenPieces: () => void
  readonly onOpenModels: () => void
  readonly onLeaveBlockedChange: (blocked: boolean) => void
  readonly switchRequest: PieceSwitchRequest
}) {
  const roster = useRoster(callSites.fetchCallSites)
  const [probe] = useLoaded(callSites.fetchRuntimeStatus, [])
  const pieceStream = usePieceStream(piece.id, room.subscribeToRoom)
  const registry = useDocumentSnapshotRegistry({
    draft: piece.surfaces.draft.text,
    storyContext: piece.surfaces.storyContext.text,
    authorContext: piece.surfaces.authorContext.text,
  })

  const [activeSurface, setActiveSurface] = useState<SurfaceId>('draft')
  const [saveFailed, setSaveFailed] = useState<BySurface<boolean>>({})
  const [closing, setClosing] = useState(false)
  const flushersRef = useRef<BySurface<() => Promise<AutosaveState>>>({})

  const leaveBlocked = closing || SURFACE_IDS.some((surface) => saveFailed[surface] === true)

  const handleSaveFailedChange = useCallback((surface: SurfaceId, failed: boolean) => {
    setSaveFailed((current) => (current[surface] === failed ? current : { ...current, [surface]: failed }))
  }, [])
  const handleFlushRegister = useCallback((surface: SurfaceId, flush: () => Promise<AutosaveState>) => {
    flushersRef.current = { ...flushersRef.current, [surface]: flush }
  }, [])

  const surfaceRoom: RoomAdapters = { ...room, subscribeToRoom: pieceStream }

  useEffect(() => {
    onLeaveBlockedChange(leaveBlocked)
  }, [leaveBlocked, onLeaveBlockedChange])

  const targetId = switchRequest.targetId
  useEffect(() => {
    if (targetId === undefined) return
    let cancelled = false
    setClosing(true)
    void closePiece(flushersRef.current).then((result) => {
      if (cancelled) return
      setClosing(false)
      switchRequest.onSettled(result.blocked)
    })
    return () => {
      cancelled = true
    }
  }, [targetId])

  return (
    <div className={styles.row}>
      {SURFACE_IDS.map((surface) => (
        <EditingSurface
          key={surface}
          pieceId={piece.id}
          title={piece.title}
          mode={piece.mode}
          namesMode={namesMode}
          body={bodyConfigFor(piece, surface)}
          initialText={piece.surfaces[surface].text}
          initialConversationId={piece.surfaces[surface].currentConversationId}
          conversationSelection={surface === 'authorContext' ? authorContextSelection : undefined}
          initialCast={piece.surfaces[surface].cast}
          initialConversations={piece.surfaces[surface].conversations}
          storyEditor={piece.storyEditor}
          interviewer={piece.interviewer}
          room={surfaceRoom}
          pieceAdapters={pieceAdapters}
          roster={roster}
          runtime={probe.kind === 'ready' ? probe.value : undefined}
          lifecycle={lifecycle}
          active={activeSurface === surface}
          onSwitchToSurface={setActiveSurface}
          onOpenPieces={onOpenPieces}
          onOpenModels={onOpenModels}
          onTextChange={registry.update}
          onSaveFailedChange={handleSaveFailedChange}
          onFlushRegister={handleFlushRegister}
          documents={registry.documents}
        />
      ))}
    </div>
  )
}

export function OpenedPiece({
  id,
  namesMode,
  pieceAdapters,
  room,
  callSites,
  authorContextSelection,
  onOpenPieces,
  onOpenModels,
  onLeaveBlockedChange,
  switchRequest,
}: OpenedPieceProps) {
  const piece = usePiece(id, pieceAdapters)

  useEffect(() => {
    if (piece.status === 'ready') return
    onLeaveBlockedChange(false)
    if (switchRequest.targetId !== undefined) switchRequest.onSettled(false)
  }, [piece.status, switchRequest.targetId])

  if (piece.status === 'ready') {
    return (
      <Surfaces
        piece={piece.piece}
        namesMode={namesMode}
        room={room}
        pieceAdapters={pieceAdapters}
        callSites={callSites}
        lifecycle={{
          retitling: piece.retitling,
          retitleError: piece.retitleError,
          onRetitle: piece.retitle,
        }}
        authorContextSelection={authorContextSelection}
        onOpenPieces={onOpenPieces}
        onOpenModels={onOpenModels}
        onLeaveBlockedChange={onLeaveBlockedChange}
        switchRequest={switchRequest}
      />
    )
  }

  return <EmptyPair state={piece.status === 'error' ? { kind: 'failed', message: piece.message } : { kind: 'opening' }} />
}
