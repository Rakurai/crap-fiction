import { useMemo, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { PieceDetail, PieceStatus, StoryEditorView } from '../shared/pieceViews.js'
import type { PieceSurfaceId } from '../shared/surfaces.js'
import { fetchCallSites, fetchRuntimeStatus } from './callSitesClient.js'
import { Conversation, type HandleEntry } from './Conversation.js'
import { ConversationSwitcher } from './ConversationSwitcher.js'
import { documentSnapshotFrom } from './documentSnapshot.js'
import { useLoaded } from './load.js'
import { Manuscript } from './Manuscript.js'
import styles from './OpenedPiece.module.css'
import { saveSurfaceDocument } from './piecesClient.js'
import { usePieceStream } from './pieceStream.js'
import { RoomEditor } from './RoomEditor.js'
import {
  abandonOperation,
  applyRecommendation,
  confirmApplication,
  createConversation,
  dispatch,
  fetchConversation,
  subscribeToRoom,
} from './roomClient.js'
import { StoryContext } from './StoryContext.js'
import { useAutosave } from './useAutosave.js'
import { useManuscript } from './useManuscript.js'
import { usePiece } from './usePiece.js'
import { useRoster } from './useRoster.js'

type OpenedPieceProps = {
  readonly id: string
  readonly onClose: () => void
}

/** A value held per editing surface, so one surface's state never bleeds into another's. */
type BySurface<T> = Readonly<Partial<Record<PieceSurfaceId, T>>>

type RoomProps = {
  readonly storyEditor: StoryEditorView
  readonly toggling: BySurface<string>
  readonly error: BySurface<string>
  readonly onToggle: (surface: PieceSurfaceId, memberId: string) => void
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
  readonly onRefresh: (surface: PieceSurfaceId) => void
  readonly deletingId: BySurface<string>
  readonly error: BySurface<string>
  readonly onDelete: (surface: PieceSurfaceId, conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
}

/**
 * One editing surface's own conversation-session state: which conversation it shows, a key that
 * forces a fresh session without depending on a conversation id `Conversation` itself may still be
 * minting, the operation it has in flight, and the participant its manuscript is held for.
 */
function useSurfaceUi(initialConversationId: string | null) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId)
  const [session, setSession] = useState(0)
  const [liveAction, setLiveAction] = useState<Readonly<{ conversationId: string; actionId: string }> | undefined>(undefined)
  const [applying, setApplying] = useState<Readonly<{ participantName: string }> | undefined>(undefined)

  function switchTo(conversationId: string | null): void {
    setActiveConversationId(conversationId)
    setSession((current) => current + 1)
  }

  return { activeConversationId, setActiveConversationId, session, switchTo, liveAction, setLiveAction, applying, setApplying }
}

type SurfaceUi = ReturnType<typeof useSurfaceUi>

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
  const manuscript = useManuscript(piece.surfaces.draft.text)
  const draftAutosave = useAutosave(manuscript.markdown, (text) => saveSurfaceDocument(piece.id, 'draft', text))

  const [storyContextText, setStoryContextText] = useState(piece.surfaces.storyContext.text)
  const storyContextAutosave = useAutosave(storyContextText, (text) => saveSurfaceDocument(piece.id, 'storyContext', text))

  const roster = useRoster(fetchCallSites)
  const [probe] = useLoaded(fetchRuntimeStatus, [])
  // One event source for the whole opened piece: every surface's conversation subscribes through
  // this rather than reconnecting the stream when the author switches which surface it shows.
  const pieceStream = usePieceStream(piece.id, subscribeToRoom)
  // The closed snapshot every author action and Apply carries: both editing surfaces' current
  // client text, unsaved text included, alongside author context as the piece last opened with.
  const documents = useMemo(
    () => documentSnapshotFrom(manuscript.markdown, storyContextText, piece.surfaces.authorContext.text),
    [manuscript.markdown, storyContextText, piece.surfaces.authorContext.text],
  )

  const [activeSurface, setActiveSurface] = useState<PieceSurfaceId>('draft')
  const [panel, setPanel] = useState<'none' | 'room' | 'conversations'>('none')

  const draftUi = useSurfaceUi(piece.surfaces.draft.currentConversationId)
  const storyContextUi = useSurfaceUi(piece.surfaces.storyContext.currentConversationId)
  const uiFor = (surface: PieceSurfaceId): SurfaceUi => (surface === 'draft' ? draftUi : storyContextUi)
  const activeUi = uiFor(activeSurface)

  const roomAdapters = {
    createConversation,
    fetchConversation,
    dispatch,
    subscribeToRoom: pieceStream,
    abandonOperation,
    applyRecommendation,
    confirmApplication,
    saveDocument: saveSurfaceDocument,
  }

  function addressableFor(surface: PieceSurfaceId): readonly HandleEntry[] {
    return [
      ...piece.surfaces[surface].cast.map(({ handle, displayName }) => ({ handle, displayName })),
      { handle: room.storyEditor.handle, displayName: room.storyEditor.displayName },
    ]
  }

  const leaveBlocked = draftAutosave.state.failed || storyContextAutosave.state.failed

  function closeAndAbandon(): void {
    if (draftUi.liveAction !== undefined) void abandonOperation(piece.id, 'draft', draftUi.liveAction.conversationId, draftUi.liveAction.actionId)
    if (storyContextUi.liveAction !== undefined) {
      void abandonOperation(piece.id, 'storyContext', storyContextUi.liveAction.conversationId, storyContextUi.liveAction.actionId)
    }
    onClose()
  }

  async function deleteConversation(surface: PieceSurfaceId, conversationId: string): Promise<void> {
    const remaining = await conversations.onDelete(surface, conversationId)
    const ui = uiFor(surface)
    if (remaining !== undefined && ui.activeConversationId === conversationId) {
      ui.switchTo(remaining[0]?.id ?? null)
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.surfacePane} hidden={activeSurface !== 'draft'} inert={activeSurface !== 'draft'}>
        <Manuscript
          title={piece.title}
          mode={piece.mode}
          onClose={closeAndAbandon}
          manuscript={manuscript}
          autosave={draftAutosave}
          leaveBlocked={leaveBlocked}
          onOpenRoom={() => setPanel('room')}
          onOpenConversations={() => {
            conversations.onRefresh('draft')
            setPanel('conversations')
          }}
          onSwitchToStoryContext={() => setActiveSurface('storyContext')}
          lifecycle={lifecycle}
          applying={draftUi.applying}
        />
        {manuscript.view !== 'reading' && roster.settled && (
          <Conversation
            key={draftUi.session}
            pieceId={piece.id}
            surface="draft"
            currentConversationId={draftUi.activeConversationId}
            documents={documents}
            flushDocument={draftAutosave.flush}
            room={roomAdapters}
            displayName={roster.displayName}
            handle={roster.handle}
            handles={addressableFor('draft')}
            runtime={probe.kind === 'ready' ? probe.value : undefined}
            clock={Date.now}
            onApplied={manuscript.applyRecommendation}
            onApplyingChange={draftUi.setApplying}
            onConversationIdChange={draftUi.setActiveConversationId}
            onActionIdChange={draftUi.setLiveAction}
          />
        )}
      </div>

      <div className={styles.surfacePane} hidden={activeSurface !== 'storyContext'} inert={activeSurface !== 'storyContext'}>
        <StoryContext
          title={piece.title}
          onClose={closeAndAbandon}
          text={storyContextText}
          onChange={setStoryContextText}
          referenceSchema={piece.surfaces.storyContext.referenceSchema}
          autosave={storyContextAutosave}
          leaveBlocked={leaveBlocked}
          onOpenRoom={() => setPanel('room')}
          onOpenConversations={() => {
            conversations.onRefresh('storyContext')
            setPanel('conversations')
          }}
          onSwitchToDraft={() => setActiveSurface('draft')}
          lifecycle={lifecycle}
          applying={storyContextUi.applying}
        />
        {roster.settled && (
          <Conversation
            key={storyContextUi.session}
            pieceId={piece.id}
            surface="storyContext"
            currentConversationId={storyContextUi.activeConversationId}
            documents={documents}
            flushDocument={storyContextAutosave.flush}
            room={roomAdapters}
            displayName={roster.displayName}
            handle={roster.handle}
            handles={addressableFor('storyContext')}
            runtime={probe.kind === 'ready' ? probe.value : undefined}
            clock={Date.now}
            onApplied={setStoryContextText}
            onApplyingChange={storyContextUi.setApplying}
            onConversationIdChange={storyContextUi.setActiveConversationId}
            onActionIdChange={storyContextUi.setLiveAction}
          />
        )}
      </div>

      {panel === 'room' && (
        <RoomEditor
          members={piece.surfaces[activeSurface].cast}
          storyEditor={room.storyEditor}
          toggling={room.toggling[activeSurface]}
          onToggle={(memberId) => room.onToggle(activeSurface, memberId)}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'conversations' && (
        <ConversationSwitcher
          conversations={piece.surfaces[activeSurface].conversations}
          activeId={activeUi.activeConversationId}
          deletingId={conversations.deletingId[activeSurface]}
          error={conversations.error[activeSurface]}
          clock={Date.now}
          onSelect={(conversationId) => {
            if (conversationId !== activeUi.activeConversationId) activeUi.switchTo(conversationId)
            setPanel('none')
          }}
          onStartNew={() => {
            if (activeUi.activeConversationId !== null) activeUi.switchTo(null)
            setPanel('none')
          }}
          onDelete={(conversationId) => deleteConversation(activeSurface, conversationId)}
          onClose={() => setPanel('none')}
        />
      )}
      {room.error[activeSurface] !== undefined && (
        <p className={styles.error} role="alert">
          {room.error[activeSurface]}
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
