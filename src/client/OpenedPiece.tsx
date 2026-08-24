import { useState } from 'react'
import type { ConversationSummary } from '../shared/conversationViews.js'
import type { CastMemberView, PieceDetail, PieceStatus } from '../shared/pieceViews.js'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { Conversation } from './Conversation.js'
import { ContextReview } from './ContextReview.js'
import { ConversationSwitcher } from './ConversationSwitcher.js'
import { useLoaded } from './load.js'
import { Manuscript } from './Manuscript.js'
import styles from './OpenedPiece.module.css'
import { saveDraft } from './piecesClient.js'
import { RoomEditor } from './RoomEditor.js'
import {
  abandonOperation,
  applyRecommendation,
  approveCapture,
  captureContext,
  createConversation,
  fetchConversation,
  startRound,
  subscribeToRoom,
} from './roomClient.js'
import { useAutosave } from './useAutosave.js'
import { useCapture } from './useCapture.js'
import { useManuscript } from './useManuscript.js'
import { usePiece } from './usePiece.js'
import { useRoster } from './useRoster.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

type RoomProps = {
  readonly cast: readonly CastMemberView[]
  readonly toggling: string | undefined
  readonly error: string | undefined
  readonly onToggle: (id: string) => void
}

type LifecycleProps = {
  readonly status: PieceStatus
  readonly retitling: boolean
  readonly retitleError: string | undefined
  readonly onRetitle: (title: string) => void
  readonly settingStatus: boolean
  readonly statusError: string | undefined
  readonly onSetStatus: (status: PieceStatus) => void
}

type ConversationsProps = {
  readonly conversations: readonly ConversationSummary[]
  readonly onRefresh: () => void
  readonly deletingId: string | undefined
  readonly error: string | undefined
  readonly onDelete: (id: string) => Promise<readonly ConversationSummary[] | undefined>
}

function Surfaces({
  piece,
  room,
  lifecycle,
  conversations,
  onClose,
}: {
  readonly piece: PieceDetail
  readonly room: RoomProps
  readonly lifecycle: LifecycleProps
  readonly conversations: ConversationsProps
  readonly onClose: () => void
}) {
  const manuscript = useManuscript(piece.draft)
  const autosave = useAutosave(piece.id, manuscript.markdown, saveDraft)
  const roster = useRoster(fetchCallSites)
  const [probe] = useLoaded(fetchRuntimeStatus, [])
  const [panel, setPanel] = useState<'none' | 'room' | 'conversations' | 'capture'>('none')
  const [applying, setApplying] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(piece.currentConversationId)
  // Keyed on this rather than on `activeConversationId`: `Conversation` reports back the id
  // it mints on a fresh conversation's first round, and remounting on that report would tear
  // that round down mid-flight.
  const [session, setSession] = useState(0)
  const capture = useCapture(piece.id, activeConversationId, () => manuscript.markdown, { captureContext, approveCapture })

  function switchTo(conversationId: string | null): void {
    setActiveConversationId(conversationId)
    setSession((current) => current + 1)
  }

  async function deleteConversation(conversationId: string): Promise<void> {
    const remaining = await conversations.onDelete(conversationId)
    if (remaining !== undefined && activeConversationId === conversationId) {
      switchTo(remaining[0]?.id ?? null)
    }
  }

  return (
    <div className={styles.row}>
      <Manuscript
        title={piece.title}
        mode={piece.mode}
        onClose={onClose}
        manuscript={manuscript}
        autosave={autosave}
        onOpenRoom={() => setPanel('room')}
        onOpenConversations={() => {
          conversations.onRefresh()
          setPanel('conversations')
        }}
        onOpenCapture={() => {
          setPanel('capture')
          if (!capture.capturing && capture.proposals.length === 0) capture.capture()
        }}
        lifecycle={lifecycle}
        applying={applying}
      />
      {manuscript.view !== 'reading' && roster.settled && (
        <Conversation
          key={session}
          pieceId={piece.id}
          currentConversationId={activeConversationId}
          roundInFlight={piece.roundInFlight?.conversationId === activeConversationId ? piece.roundInFlight : null}
          draft={manuscript.markdown}
          flushDraft={autosave.flush}
          room={{ createConversation, fetchConversation, startRound, subscribeToRoom, abandonOperation, applyRecommendation }}
          displayName={roster.displayName}
          mark={roster.mark}
          handle={roster.handle}
          handles={roster.handles}
          runtime={probe.kind === 'ready' ? probe.value : undefined}
          clock={Date.now}
          onApplied={manuscript.applyRecommendation}
          onApplyingChange={setApplying}
          onConversationIdChange={setActiveConversationId}
        />
      )}
      {panel === 'room' && (
        <RoomEditor members={room.cast} toggling={room.toggling} onToggle={room.onToggle} onClose={() => setPanel('none')} />
      )}
      {panel === 'conversations' && (
        <ConversationSwitcher
          conversations={conversations.conversations}
          activeId={activeConversationId}
          deletingId={conversations.deletingId}
          error={conversations.error}
          clock={Date.now}
          onSelect={(conversationId) => {
            if (conversationId !== activeConversationId) switchTo(conversationId)
            setPanel('none')
          }}
          onStartNew={() => {
            if (activeConversationId !== null) switchTo(null)
            setPanel('none')
          }}
          onDelete={deleteConversation}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'capture' && (
        <ContextReview
          proposals={capture.proposals}
          approved={capture.approved}
          closing={capture.closing}
          error={capture.error}
          onToggle={capture.toggle}
          onClose={() => {
            capture.close()
            setPanel('none')
          }}
        />
      )}
      {room.error !== undefined && (
        <p className={styles.error} role="alert">
          {room.error}
        </p>
      )}
    </div>
  )
}

export function OpenedPiece({ id, onClose }: OpenedPieceProps) {
  const piece = usePiece(id)

  function leave(): void {
    void abandonOperation(id)
    onClose()
  }

  if (piece.status === 'ready') {
    return (
      <Surfaces
        piece={piece.piece}
        room={{ cast: piece.piece.cast, toggling: piece.castToggling, error: piece.castError, onToggle: piece.toggleCast }}
        lifecycle={{
          status: piece.piece.status,
          retitling: piece.retitling,
          retitleError: piece.retitleError,
          onRetitle: piece.retitle,
          settingStatus: piece.settingStatus,
          statusError: piece.statusError,
          onSetStatus: piece.setStatus,
        }}
        conversations={{
          conversations: piece.piece.conversations,
          onRefresh: piece.refreshConversations,
          deletingId: piece.deletingConversationId,
          error: piece.conversationsError,
          onDelete: piece.deleteConversation,
        }}
        onClose={leave}
      />
    )
  }

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.back} onClick={leave}>
        ‹ pieces
      </button>
      {piece.status === 'loading' && <p className={styles.status}>Opening…</p>}
      {piece.status === 'error' && (
        <p className={styles.error} role="alert">
          {piece.message}
        </p>
      )}
    </div>
  )
}
