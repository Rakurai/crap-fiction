import { useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { CastMemberView, PieceDetail, PieceStatus, StoryEditorView } from '../shared/pieceViews.js'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { Conversation, type HandleEntry } from './Conversation.js'
import { ConversationSwitcher } from './ConversationSwitcher.js'
import { useLoaded } from './load.js'
import { Manuscript } from './Manuscript.js'
import styles from './OpenedPiece.module.css'
import { saveDraft } from './piecesClient.js'
import { RoomEditor } from './RoomEditor.js'
import { abandonOperation, applyRecommendation, createConversation, dispatch, fetchConversation, subscribeToRoom } from './roomClient.js'
import { useAutosave } from './useAutosave.js'
import { useManuscript } from './useManuscript.js'
import { usePiece } from './usePiece.js'
import { useRoster } from './useRoster.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

type RoomProps = {
  readonly cast: readonly CastMemberView[]
  readonly storyEditor: StoryEditorView
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
  const [panel, setPanel] = useState<'none' | 'room' | 'conversations'>('none')
  const [applying, setApplying] = useState<{ readonly participantName: string } | undefined>(undefined)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(piece.currentConversationId)
  // Keyed on this rather than on `activeConversationId`, which `Conversation` reports back when it
  // mints one on a first dispatch: remounting on that report would tear the dispatch down mid-flight.
  const [session, setSession] = useState(0)
  const [liveAction, setLiveAction] = useState<{ readonly conversationId: string; readonly actionId: string } | undefined>(undefined)

  const addressable: readonly HandleEntry[] = [
    ...room.cast.map(({ handle, displayName }) => ({ handle, displayName })),
    { handle: room.storyEditor.handle, displayName: room.storyEditor.displayName },
  ]

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

  function closeAndAbandon(): void {
    if (liveAction !== undefined) void abandonOperation(piece.id, liveAction.conversationId, liveAction.actionId)
    onClose()
  }

  return (
    <div className={styles.row}>
      <Manuscript
        title={piece.title}
        mode={piece.mode}
        onClose={closeAndAbandon}
        manuscript={manuscript}
        autosave={autosave}
        onOpenRoom={() => setPanel('room')}
        onOpenConversations={() => {
          conversations.onRefresh()
          setPanel('conversations')
        }}
        lifecycle={lifecycle}
        applying={applying}
      />
      {manuscript.view !== 'reading' && roster.settled && (
        <Conversation
          key={session}
          pieceId={piece.id}
          currentConversationId={activeConversationId}
          conversationActionInFlight={
            piece.conversationActionInFlight !== null && piece.conversationActionInFlight.conversationId === activeConversationId
              ? piece.conversationActionInFlight
              : null
          }
          draft={manuscript.markdown}
          flushDraft={autosave.flush}
          room={{ createConversation, fetchConversation, dispatch, subscribeToRoom, abandonOperation, applyRecommendation }}
          displayName={roster.displayName}
          handle={roster.handle}
          handles={addressable}
          runtime={probe.kind === 'ready' ? probe.value : undefined}
          clock={Date.now}
          onApplied={manuscript.applyRecommendation}
          onApplyingChange={setApplying}
          onConversationIdChange={setActiveConversationId}
          onActionIdChange={setLiveAction}
        />
      )}
      {panel === 'room' && (
        <RoomEditor
          members={room.cast}
          storyEditor={room.storyEditor}
          toggling={room.toggling}
          onToggle={room.onToggle}
          onClose={() => setPanel('none')}
        />
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

  if (piece.status === 'ready') {
    return (
      <Surfaces
        piece={piece.piece}
        room={{
          cast: piece.piece.cast,
          storyEditor: piece.piece.storyEditor,
          toggling: piece.castToggling,
          error: piece.castError,
          onToggle: piece.toggleCast,
        }}
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
        onClose={onClose}
      />
    )
  }

  return (
    <div className={styles.screen}>
      <button type="button" className={styles.back} onClick={onClose}>
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
