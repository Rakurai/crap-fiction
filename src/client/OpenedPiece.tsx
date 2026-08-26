import { useMemo, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { PieceDetail, PieceStatus, StoryEditorView } from '../shared/pieceViews.js'
import type { SurfaceId } from '../shared/surfaces.js'
import { AuthorContext } from './AuthorContext.js'
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

/** The author context's conversation selection: global client state, so a piece switch never resets it. */
export type AuthorContextSelection = Readonly<{ value: string | null | undefined; onChange: (conversationId: string | null) => void }>

type OpenedPieceProps = {
  readonly id: string
  /** Omitted, the author-context conversation selection is local to this mount, same as the other surfaces. */
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onClose: () => void
}

/** A value held per editing surface, so one surface's state never bleeds into another's. */
type BySurface<T> = Readonly<Partial<Record<SurfaceId, T>>>

type RoomProps = {
  readonly storyEditor: StoryEditorView
  readonly toggling: BySurface<string>
  readonly error: BySurface<string>
  readonly onToggle: (surface: SurfaceId, memberId: string) => void
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
  readonly onRefresh: (surface: SurfaceId) => void
  readonly deletingId: BySurface<string>
  readonly error: BySurface<string>
  readonly onDelete: (surface: SurfaceId, conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
}

/**
 * One editing surface's own conversation-session state: which conversation it shows, a key that
 * forces a fresh session without depending on a conversation id `Conversation` itself may still be
 * minting, the operation it has in flight, and the participant its manuscript is held for.
 *
 * `global`, when given, holds the selection outside this component tree instead — author context's
 * selection outlives the piece that is open, so a piece switch cannot reset it the way remounting
 * this hook's own state would. `setActiveConversationId` is handed to a descendant as an effect
 * dependency (`Conversation`'s own projection of it), so it must keep one stable identity per
 * target rather than a fresh closure every render — either the `useState` setter itself, or
 * `global.onChange`, both of which React and the caller already keep stable.
 */
function useSurfaceUi(initialConversationId: string | null, global?: AuthorContextSelection) {
  const [localConversationId, setLocalConversationId] = useState<string | null>(initialConversationId)
  const activeConversationId = global === undefined ? localConversationId : global.value === undefined ? initialConversationId : global.value
  const [session, setSession] = useState(0)
  const [liveAction, setLiveAction] = useState<Readonly<{ conversationId: string; actionId: string }> | undefined>(undefined)
  const [applying, setApplying] = useState<Readonly<{ participantName: string }> | undefined>(undefined)

  const setActiveConversationId = global === undefined ? setLocalConversationId : global.onChange

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
  authorContextSelection,
  onClose,
}: {
  readonly piece: PieceDetail
  readonly room: RoomProps
  readonly lifecycle: LifecycleProps
  readonly conversations: ConversationsProps
  readonly authorContextSelection?: AuthorContextSelection | undefined
  readonly onClose: () => void
}) {
  const manuscript = useManuscript(piece.surfaces.draft.text)
  const draftAutosave = useAutosave(manuscript.markdown, (text) => saveSurfaceDocument(piece.id, 'draft', text))

  const [storyContextText, setStoryContextText] = useState(piece.surfaces.storyContext.text)
  const storyContextAutosave = useAutosave(storyContextText, (text) => saveSurfaceDocument(piece.id, 'storyContext', text))

  const [authorContextText, setAuthorContextText] = useState(piece.surfaces.authorContext.text)
  const authorContextAutosave = useAutosave(authorContextText, (text) => saveSurfaceDocument(piece.id, 'authorContext', text))

  const roster = useRoster(fetchCallSites)
  const [probe] = useLoaded(fetchRuntimeStatus, [])
  // One event source for the whole opened piece: every surface's conversation subscribes through
  // this rather than reconnecting the stream when the author switches which surface it shows.
  const pieceStream = usePieceStream(piece.id, subscribeToRoom)
  // The closed snapshot every author action and Apply carries: every editing surface's current
  // client text, unsaved text included — author context's is this piece's transient evidence, not
  // the global document itself.
  const documents = useMemo(
    () => documentSnapshotFrom(manuscript.markdown, storyContextText, authorContextText),
    [manuscript.markdown, storyContextText, authorContextText],
  )

  const [activeSurface, setActiveSurface] = useState<SurfaceId>('draft')
  const [panel, setPanel] = useState<'none' | 'room' | 'conversations'>('none')

  const draftUi = useSurfaceUi(piece.surfaces.draft.currentConversationId)
  const storyContextUi = useSurfaceUi(piece.surfaces.storyContext.currentConversationId)
  const authorContextUi = useSurfaceUi(piece.surfaces.authorContext.currentConversationId, authorContextSelection)
  const uiFor = (surface: SurfaceId): SurfaceUi => (surface === 'draft' ? draftUi : surface === 'storyContext' ? storyContextUi : authorContextUi)
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

  function addressableFor(surface: SurfaceId): readonly HandleEntry[] {
    return [
      ...piece.surfaces[surface].cast.map(({ handle, displayName }) => ({ handle, displayName })),
      { handle: room.storyEditor.handle, displayName: room.storyEditor.displayName },
    ]
  }

  const leaveBlocked = draftAutosave.state.failed || storyContextAutosave.state.failed || authorContextAutosave.state.failed

  function closeAndAbandon(): void {
    if (draftUi.liveAction !== undefined) void abandonOperation(piece.id, 'draft', draftUi.liveAction.conversationId, draftUi.liveAction.actionId)
    if (storyContextUi.liveAction !== undefined) {
      void abandonOperation(piece.id, 'storyContext', storyContextUi.liveAction.conversationId, storyContextUi.liveAction.actionId)
    }
    if (authorContextUi.liveAction !== undefined) {
      void abandonOperation(piece.id, 'authorContext', authorContextUi.liveAction.conversationId, authorContextUi.liveAction.actionId)
    }
    onClose()
  }

  async function deleteConversation(surface: SurfaceId, conversationId: string): Promise<void> {
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
          onSwitchToAuthorContext={() => setActiveSurface('authorContext')}
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
          onSwitchToAuthorContext={() => setActiveSurface('authorContext')}
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

      <div className={styles.surfacePane} hidden={activeSurface !== 'authorContext'} inert={activeSurface !== 'authorContext'}>
        <AuthorContext
          title={piece.title}
          onClose={closeAndAbandon}
          text={authorContextText}
          onChange={setAuthorContextText}
          referenceSchema={piece.surfaces.authorContext.referenceSchema}
          autosave={authorContextAutosave}
          leaveBlocked={leaveBlocked}
          onOpenRoom={() => setPanel('room')}
          onOpenConversations={() => {
            conversations.onRefresh('authorContext')
            setPanel('conversations')
          }}
          onSwitchToDraft={() => setActiveSurface('draft')}
          onSwitchToStoryContext={() => setActiveSurface('storyContext')}
          lifecycle={lifecycle}
          applying={authorContextUi.applying}
        />
        {roster.settled && (
          <Conversation
            key={authorContextUi.session}
            pieceId={piece.id}
            surface="authorContext"
            currentConversationId={authorContextUi.activeConversationId}
            documents={documents}
            flushDocument={authorContextAutosave.flush}
            room={roomAdapters}
            displayName={roster.displayName}
            handle={roster.handle}
            handles={addressableFor('authorContext')}
            runtime={probe.kind === 'ready' ? probe.value : undefined}
            clock={Date.now}
            onApplied={setAuthorContextText}
            onApplyingChange={authorContextUi.setApplying}
            onConversationIdChange={authorContextUi.setActiveConversationId}
            onActionIdChange={authorContextUi.setLiveAction}
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

export function OpenedPiece({ id, authorContextSelection, onClose }: OpenedPieceProps) {
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
        authorContextSelection={authorContextSelection}
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
