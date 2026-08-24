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

/** #19 "Piece lifecycle": retitling and marking a piece finished or abandoned, bundled the same way `RoomProps` bundles the cast toggle. */
type LifecycleProps = {
  readonly status: PieceStatus
  readonly retitling: boolean
  readonly retitleError: string | undefined
  readonly onRetitle: (title: string) => void
  readonly settingStatus: boolean
  readonly statusError: string | undefined
  readonly onSetStatus: (status: PieceStatus) => void
}

/** #17 "Conversations": the listing and its two actions, bundled the same way `RoomProps` bundles the cast toggle. */
type ConversationsProps = {
  readonly conversations: readonly ConversationSummary[]
  readonly onRefresh: () => void
  readonly deletingId: string | undefined
  readonly error: string | undefined
  readonly onDelete: (id: string) => Promise<readonly ConversationSummary[] | undefined>
}

/**
 * UX_DESIGN "Design thesis": two surfaces are always present, the prose and the
 * conversation about it. This is the one place that knows they are two — it owns
 * the manuscript's text and its autosave, which both surfaces need, and it is
 * where each surface's adapters are wired (CODING_STANDARDS "Dependencies and
 * injection": the composition root is where they are wired). Neither surface
 * imports what the other performs, and neither carries the other's
 * collaborators through as props it never uses.
 *
 * The prose renders as soon as the piece is read; the conversation waits for the
 * room's names. That order is the priority UX_DESIGN states — prose first — and
 * it is what keeps a participant from being drawn under its internal id for the
 * moment before the roster lands.
 */
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
  // Whether the room can be reached is asked here, where the author is working,
  // rather than only on the models screen: it is the composer's notice, and the
  // composer is on this screen.
  const [probe] = useLoaded(fetchRuntimeStatus, [])
  // UX_DESIGN "Prominence": editing the room owns no permanent space — it
  // arrives on the one action that reaches it and leaves on the one that
  // closes it. Conversations, the room and capture context's review are the
  // same tier and never more than one open at once, so one flag names which
  // — if any — is up.
  const [panel, setPanel] = useState<'none' | 'room' | 'conversations' | 'capture'>('none')
  // SPEC "Applying a recommendation": the manuscript's own read-only lock,
  // held for exactly the duration of the call — a fact `Conversation` learns
  // first, since applying is one of the actions a response offers, and
  // mirrored here because `Manuscript` is the surface the lock is drawn on.
  const [applying, setApplying] = useState(false)
  // #17 "Conversations": which conversation this session is addressing —
  // the piece's own most-recently-active one at first (CONTEXT
  // "Conversation": opening a piece resumes it), and afterwards whichever
  // the author chose from the listing or started fresh. `null` is an
  // intention rather than a conversation, same as the piece's own report.
  const [activeConversationId, setActiveConversationId] = useState<string | null>(piece.currentConversationId)
  // `Conversation` mints its own id the moment a fresh one's first round
  // opens, and reports it back here purely so the listing can mark it
  // current — that report must not itself force a remount, or a round just
  // opened against a brand new conversation would be torn down mid-flight.
  // `session` is the deliberate signal: switching to a different
  // conversation or starting another is what actually needs a clean
  // instance, and each is its own explicit action below.
  const [session, setSession] = useState(0)
  // #18 "Capture context": the analysis's own draft is read the same way
  // `Conversation` reads it for a round or an application — a closure over
  // the manuscript's current text, since the room never reads it from disk.
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
          // Reopening a review already in progress must not restart the
          // analysis underneath it — only a review with nothing pending asks
          // for a fresh one.
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
            // `close` finishes after this handler returns, so the panel is
            // left rather than watched for it to empty itself. A partial
            // failure leaves its proposals and its error sitting in the
            // hook regardless — reopening "capture context" shows exactly
            // that state again rather than starting a fresh analysis, since
            // `onOpenCapture` below only asks for one when nothing is pending.
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

  /**
   * SPEC "Substrate": switching pieces abandons whatever operation is in
   * flight, which keeps whatever landed. Asked unconditionally — the room's
   * own abandon is a legitimate no-op when nothing was running (SPEC
   * "Seams") — rather than this surface tracking whether one was, which
   * would be inventing a fact the room already owns.
   */
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
