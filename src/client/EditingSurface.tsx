import { useEffect, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { CastMemberView, StoryEditorView } from '../shared/pieceViews.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import { ContextSurface, isContextSurfaceId } from './ContextSurface.js'
import { Conversation, type HandleEntry } from './Conversation.js'
import { ConversationSwitcher } from './ConversationSwitcher.js'
import styles from './EditingSurface.module.css'
import { Manuscript } from './Manuscript.js'
import type { LifecycleProps } from './pieceLifecycle.js'
import { RoomEditor } from './RoomEditor.js'
import type { RosterViewModel } from './useRoster.js'
import { type AuthorContextSelection, type LiveAction, useConversationSession } from './useConversationSession.js'
import { useDocumentSession, type DocumentSessionKind } from './useDocumentSession.js'
import type { RoomAdapters } from './useConversation.js'

export type SurfaceBodyConfig =
  | Readonly<{ kind: 'prose' }>
  | Readonly<{ kind: 'plainText'; referenceSchema: string | null }>

function documentSessionKindOf(body: SurfaceBodyConfig): DocumentSessionKind {
  return body.kind === 'prose' ? 'prose' : 'plainText'
}

type EditingSurfaceProps = {
  readonly pieceId: string
  readonly surface: SurfaceId
  readonly title: string
  readonly mode: string
  readonly body: SurfaceBodyConfig
  readonly initialText: string
  readonly initialConversationId: string | null
  /** Given only for author context: its selection is global, outlasting the piece that is open. */
  readonly conversationSelection?: AuthorContextSelection | undefined
  readonly cast: readonly CastMemberView[]
  readonly conversations: readonly ConversationSummary[]
  readonly storyEditor: StoryEditorView
  readonly room: RoomAdapters
  readonly roster: RosterViewModel
  readonly runtime: { readonly reachable: boolean } | undefined
  readonly lifecycle: LifecycleProps
  readonly active: boolean
  readonly onSwitchToSurface: (surface: SurfaceId) => void
  /** Whether leaving the piece is refused — this surface's own failed save, or another's. */
  readonly leaveBlocked: boolean
  readonly onClose: () => void
  readonly onTextChange: (surface: SurfaceId, text: string) => void
  readonly onSaveFailedChange: (surface: SurfaceId, failed: boolean) => void
  readonly onLiveActionChange: (surface: SurfaceId, action: LiveAction | undefined) => void
  /** Reported once, so the shell can flush and wait on this surface's write when the piece closes. */
  readonly onFlushRegister: (surface: SurfaceId, flush: () => Promise<AutosaveState>) => void
  readonly documents: DocumentSnapshot
  readonly castToggling: string | undefined
  readonly castError: string | undefined
  readonly onToggleCast: (memberId: string) => void
  readonly deletingConversationId: string | undefined
  readonly conversationsError: string | undefined
  readonly onDeleteConversation: (conversationId: string) => Promise<readonly ConversationSummary[] | undefined>
  readonly onRefreshConversations: () => void
}

/**
 * One editing surface, mounted once per surface `OpenedPiece` opens. It owns everything specific
 * to this surface — its document session and persistence, its conversation selection and session,
 * its cast controls, its Apply and abandonment, and the body that composes its document with its
 * conversation panel — and reports upward only what the shell needs from outside this surface: its
 * current text (into the shell's document-snapshot registry), whether its own save is failing
 * (into the shell's aggregate leave-blocking) and what it has in flight (so the shell can abandon it
 * on close). Nothing else about one surface reaches another.
 */
export function EditingSurface({
  pieceId,
  surface,
  title,
  mode,
  body,
  initialText,
  initialConversationId,
  conversationSelection,
  cast,
  conversations,
  storyEditor,
  room,
  roster,
  runtime,
  lifecycle,
  active,
  onSwitchToSurface,
  leaveBlocked,
  onClose,
  onTextChange,
  onSaveFailedChange,
  onLiveActionChange,
  onFlushRegister,
  documents,
  castToggling,
  castError,
  onToggleCast,
  deletingConversationId,
  conversationsError,
  onDeleteConversation,
  onRefreshConversations,
}: EditingSurfaceProps) {
  const documentSession = useDocumentSession(documentSessionKindOf(body), initialText, (text) => room.saveDocument(pieceId, surface, text))
  const conversation = useConversationSession(initialConversationId, conversationSelection)
  const [panel, setPanel] = useState<'none' | 'room' | 'conversations'>('none')

  useEffect(() => {
    onTextChange(surface, documentSession.text)
  }, [surface, documentSession.text, onTextChange])

  useEffect(() => {
    onSaveFailedChange(surface, documentSession.autosave.state.failed)
  }, [surface, documentSession.autosave.state.failed, onSaveFailedChange])

  useEffect(() => {
    onLiveActionChange(surface, conversation.liveAction)
  }, [surface, conversation.liveAction, onLiveActionChange])

  useEffect(() => {
    onFlushRegister(surface, documentSession.autosave.flush)
  }, [surface, documentSession.autosave.flush, onFlushRegister])

  const handles: readonly HandleEntry[] = [
    ...cast.map(({ handle, displayName }) => ({ handle, displayName })),
    { handle: storyEditor.handle, displayName: storyEditor.displayName },
  ]

  async function deleteConversation(conversationId: string): Promise<void> {
    const remaining = await onDeleteConversation(conversationId)
    if (remaining !== undefined && conversation.activeConversationId === conversationId) {
      conversation.switchTo(remaining[0]?.id ?? null)
    }
  }

  const showConversation = roster.settled && !(documentSession.kind === 'prose' && documentSession.manuscript.view === 'reading')

  return (
    <div className={styles.surfacePane} hidden={!active} inert={!active}>
      {documentSession.kind === 'prose' ? (
        <Manuscript
          title={title}
          mode={mode}
          onClose={onClose}
          manuscript={documentSession.manuscript}
          autosave={documentSession.autosave}
          leaveBlocked={leaveBlocked}
          onOpenRoom={() => setPanel('room')}
          onOpenConversations={() => {
            onRefreshConversations()
            setPanel('conversations')
          }}
          onSwitchToStoryContext={() => onSwitchToSurface('storyContext')}
          onSwitchToAuthorContext={() => onSwitchToSurface('authorContext')}
          lifecycle={lifecycle}
          applying={conversation.applying}
        />
      ) : isContextSurfaceId(surface) ? (
        <ContextSurface
          surface={surface}
          title={title}
          onClose={onClose}
          text={documentSession.text}
          onChange={documentSession.setText}
          referenceSchema={body.kind === 'plainText' ? body.referenceSchema : null}
          autosave={documentSession.autosave}
          leaveBlocked={leaveBlocked}
          onOpenRoom={() => setPanel('room')}
          onOpenConversations={() => {
            onRefreshConversations()
            setPanel('conversations')
          }}
          onSwitchTo={onSwitchToSurface}
          lifecycle={lifecycle}
          applying={conversation.applying}
        />
      ) : null}
      {showConversation && (
        <Conversation
          key={conversation.session}
          pieceId={pieceId}
          surface={surface}
          currentConversationId={conversation.activeConversationId}
          documents={documents}
          flushDocument={documentSession.autosave.flush}
          room={room}
          displayName={roster.displayName}
          handle={roster.handle}
          handles={handles}
          runtime={runtime}
          clock={Date.now}
          onApplied={documentSession.install}
          onApplyingChange={conversation.setApplying}
          onConversationIdChange={conversation.setActiveConversationId}
          onActionIdChange={conversation.setLiveAction}
        />
      )}
      {panel === 'room' && (
        <RoomEditor
          members={cast}
          storyEditor={storyEditor}
          toggling={castToggling}
          onToggle={onToggleCast}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'conversations' && (
        <ConversationSwitcher
          conversations={conversations}
          activeId={conversation.activeConversationId}
          deletingId={deletingConversationId}
          error={conversationsError}
          clock={Date.now}
          onSelect={(conversationId) => {
            if (conversationId !== conversation.activeConversationId) conversation.switchTo(conversationId)
            setPanel('none')
          }}
          onStartNew={() => {
            if (conversation.activeConversationId !== null) conversation.switchTo(null)
            setPanel('none')
          }}
          onDelete={(conversationId) => void deleteConversation(conversationId)}
          onClose={() => setPanel('none')}
        />
      )}
      {castError !== undefined && (
        <p className={styles.error} role="alert">
          {castError}
        </p>
      )}
    </div>
  )
}
