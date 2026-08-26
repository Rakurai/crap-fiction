import { useEffect, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { CastMemberView, StoryEditorView } from '../shared/pieceViews.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import type { AutosaveState } from './autosave.js'
import { ContextSurface, type ContextSurfaceId } from './ContextSurface.js'
import { Conversation, type HandleEntry } from './Conversation.js'
import { ConversationSwitcher } from './ConversationSwitcher.js'
import styles from './EditingSurface.module.css'
import { Manuscript } from './Manuscript.js'
import type { LifecycleProps } from './pieceLifecycle.js'
import { RoomEditor } from './RoomEditor.js'
import type { RosterViewModel } from './useRoster.js'
import { type AuthorContextSelection, useConversationSession } from './useConversationSession.js'
import { usePlainTextSession, useProseSession, type PlainTextSession, type ProseSession } from './useDocumentSession.js'
import type { RoomAdapters } from './useConversation.js'
import { useSurfaceCast } from './useSurfaceCast.js'
import { useSurfaceConversations } from './useSurfaceConversations.js'

/** The surface identity travels with its body so its document and room state cannot disagree. */
export type SurfaceBodyConfig =
  | Readonly<{ kind: 'prose'; surface: 'draft' }>
  | Readonly<{ kind: 'plainText'; surface: ContextSurfaceId; referenceSchema: string | null }>

type EditingSurfaceProps = {
  readonly pieceId: string
  readonly title: string
  readonly mode: string
  readonly body: SurfaceBodyConfig
  readonly initialText: string
  readonly initialConversationId: string | null
  /** Given only for author context: its selection is global, outlasting the piece that is open. */
  readonly conversationSelection?: AuthorContextSelection | undefined
  readonly initialCast: readonly CastMemberView[]
  readonly initialConversations: readonly ConversationSummary[]
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
  /** Reported once, so the shell can flush and wait on this surface's write when the piece closes. */
  readonly onFlushRegister: (surface: SurfaceId, flush: () => Promise<AutosaveState>) => void
  readonly documents: DocumentSnapshot
}

type MountedProps = Omit<EditingSurfaceProps, 'body' | 'initialText'>

type MountedDocument =
  | Readonly<{ kind: 'prose'; surface: 'draft'; session: ProseSession }>
  | Readonly<{ kind: 'plainText'; surface: ContextSurfaceId; session: PlainTextSession; referenceSchema: string | null }>

/**
 * One editing surface, mounted once per surface `OpenedPiece` opens. It owns its document session and
 * persistence, its cast, its conversations, its Apply and abandonment, and reports upward only its
 * current text and whether its own save is failing.
 *
 * Which body draws the document decides which document session the surface has, so the two are
 * chosen together, once, at a mount that never switches from one to the other.
 */
export function EditingSurface({ body, initialText, ...mounted }: EditingSurfaceProps) {
  return body.kind === 'prose' ? (
    <ProseEditingSurface {...mounted} initialText={initialText} />
  ) : (
    <PlainTextEditingSurface {...mounted} initialText={initialText} surface={body.surface} referenceSchema={body.referenceSchema} />
  )
}

function ProseEditingSurface({ initialText, ...mounted }: MountedProps & { readonly initialText: string }) {
  const { pieceId, room } = mounted
  const session = useProseSession(initialText, (text) => room.saveDocument(pieceId, 'draft', text))
  return <MountedSurface {...mounted} document={{ kind: 'prose', surface: 'draft', session }} />
}

function PlainTextEditingSurface({
  initialText,
  surface,
  referenceSchema,
  ...mounted
}: MountedProps & { readonly initialText: string; readonly surface: ContextSurfaceId; readonly referenceSchema: string | null }) {
  const { pieceId, room } = mounted
  const session = usePlainTextSession(initialText, (text) => room.saveDocument(pieceId, surface, text))
  return <MountedSurface {...mounted} document={{ kind: 'plainText', surface, session, referenceSchema }} />
}

function MountedSurface({
  pieceId,
  title,
  mode,
  document,
  initialConversationId,
  conversationSelection,
  initialCast,
  initialConversations,
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
  onFlushRegister,
  documents,
}: MountedProps & { readonly document: MountedDocument }) {
  const { surface, session } = document
  const conversation = useConversationSession(initialConversationId, conversationSelection)
  const cast = useSurfaceCast(pieceId, surface, initialCast)
  const conversations = useSurfaceConversations(pieceId, surface, initialConversations)
  const [panel, setPanel] = useState<'none' | 'room' | 'conversations'>('none')

  useEffect(() => {
    onTextChange(surface, session.text)
  }, [surface, session.text, onTextChange])

  useEffect(() => {
    onSaveFailedChange(surface, session.autosave.state.failed)
  }, [surface, session.autosave.state.failed, onSaveFailedChange])

  useEffect(() => {
    onFlushRegister(surface, session.autosave.flush)
  }, [surface, session.autosave.flush, onFlushRegister])

  const handles: readonly HandleEntry[] = [
    ...cast.members.map(({ handle, displayName }) => ({ handle, displayName })),
    { handle: storyEditor.handle, displayName: storyEditor.displayName },
  ]

  async function deleteConversation(conversationId: string): Promise<void> {
    const remaining = await conversations.remove(conversationId)
    if (remaining !== undefined && conversation.activeConversationId === conversationId) {
      conversation.switchTo(remaining[0]?.id ?? null)
    }
  }

  function openConversations(): void {
    conversations.refresh()
    setPanel('conversations')
  }

  const showConversation = roster.settled && !(document.kind === 'prose' && document.session.manuscript.view === 'reading')

  return (
    <div className={styles.surfacePane} hidden={!active} inert={!active}>
      {document.kind === 'prose' ? (
        <Manuscript
          title={title}
          mode={mode}
          onClose={onClose}
          manuscript={document.session.manuscript}
          autosave={session.autosave}
          leaveBlocked={leaveBlocked}
          onOpenRoom={() => setPanel('room')}
          onOpenConversations={openConversations}
          onSwitchToStoryContext={() => onSwitchToSurface('storyContext')}
          onSwitchToAuthorContext={() => onSwitchToSurface('authorContext')}
          lifecycle={lifecycle}
          applying={conversation.applying}
        />
      ) : (
        <ContextSurface
          surface={document.surface}
          title={title}
          onClose={onClose}
          text={document.session.text}
          onChange={document.session.setText}
          referenceSchema={document.referenceSchema}
          autosave={session.autosave}
          leaveBlocked={leaveBlocked}
          onOpenRoom={() => setPanel('room')}
          onOpenConversations={openConversations}
          onSwitchTo={onSwitchToSurface}
          lifecycle={lifecycle}
          applying={conversation.applying}
        />
      )}
      {showConversation && (
        <Conversation
          key={conversation.session}
          pieceId={pieceId}
          surface={surface}
          currentConversationId={conversation.activeConversationId}
          documents={documents}
          flushDocument={session.autosave.flush}
          room={room}
          displayName={roster.displayName}
          handle={roster.handle}
          handles={handles}
          runtime={runtime}
          clock={Date.now}
          onApplied={session.install}
          onApplyingChange={conversation.setApplying}
          onConversationIdChange={conversation.setActiveConversationId}
        />
      )}
      {panel === 'room' && (
        <RoomEditor
          members={cast.members}
          storyEditor={storyEditor}
          toggling={cast.toggling}
          onToggle={cast.toggle}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'conversations' && (
        <ConversationSwitcher
          conversations={conversations.listed}
          activeId={conversation.activeConversationId}
          deletingId={conversations.deletingId}
          error={conversations.error}
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
      {cast.error !== undefined && (
        <p className={styles.error} role="alert">
          {cast.error}
        </p>
      )}
    </div>
  )
}
