import { useEffect, useState } from 'react'
import type { ConversationSummary } from '../shared/conversationEntries.js'
import type { CastMemberView, InterviewerView, StoryEditorView } from '../shared/pieceViews.js'
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
import type { PieceAdapters } from './usePiece.js'
import { useSurfaceCast } from './useSurfaceCast.js'
import { useSurfaceConversations } from './useSurfaceConversations.js'

export type SurfaceBodyConfig =
  | Readonly<{ kind: 'prose'; surface: 'draft'; location: string }>
  | Readonly<{ kind: 'plainText'; surface: ContextSurfaceId; location: string; referenceSchema: string | null }>

type EditingSurfaceProps = {
  readonly pieceId: string
  readonly title: string
  readonly mode: string
  readonly namesMode: boolean
  readonly body: SurfaceBodyConfig
  readonly initialText: string
  readonly initialConversationId: string | null
  readonly conversationSelection?: AuthorContextSelection | undefined
  readonly initialCast: readonly CastMemberView[]
  readonly initialConversations: readonly ConversationSummary[]
  readonly storyEditor: StoryEditorView
  readonly interviewer: InterviewerView
  readonly room: RoomAdapters
  readonly pieceAdapters: PieceAdapters
  readonly roster: RosterViewModel
  readonly runtime: { readonly reachable: boolean } | undefined
  readonly lifecycle: LifecycleProps
  readonly active: boolean
  readonly onSwitchToSurface: (surface: SurfaceId) => void
  readonly onOpenPieces: () => void
  readonly onOpenModels: () => void
  readonly onTextChange: (surface: SurfaceId, text: string) => void
  readonly onSaveFailedChange: (surface: SurfaceId, failed: boolean) => void
  readonly onFlushRegister: (surface: SurfaceId, flush: () => Promise<AutosaveState>) => void
  readonly documents: DocumentSnapshot
}

type MountedProps = Omit<EditingSurfaceProps, 'body' | 'initialText'>

type ProseBody = Extract<SurfaceBodyConfig, { kind: 'prose' }>
type PlainTextBody = Extract<SurfaceBodyConfig, { kind: 'plainText' }>

type MountedDocument =
  | Readonly<ProseBody & { session: ProseSession }>
  | Readonly<PlainTextBody & { session: PlainTextSession }>

export function EditingSurface({ body, initialText, ...mounted }: EditingSurfaceProps) {
  return body.kind === 'prose' ? (
    <ProseEditingSurface {...mounted} initialText={initialText} body={body} />
  ) : (
    <PlainTextEditingSurface {...mounted} initialText={initialText} body={body} />
  )
}

function ProseEditingSurface({ initialText, body, ...mounted }: MountedProps & { readonly initialText: string; readonly body: ProseBody }) {
  const { pieceId, room } = mounted
  const session = useProseSession(initialText, (text) => room.saveDocument(pieceId, 'draft', text))
  return <MountedSurface {...mounted} document={{ ...body, session }} />
}

function PlainTextEditingSurface({
  initialText,
  body,
  ...mounted
}: MountedProps & { readonly initialText: string; readonly body: PlainTextBody }) {
  const { pieceId, room } = mounted
  const session = usePlainTextSession(initialText, (text) => room.saveDocument(pieceId, body.surface, text))
  return <MountedSurface {...mounted} document={{ ...body, session }} />
}

function MountedSurface({
  pieceId,
  title,
  mode,
  namesMode,
  document,
  initialConversationId,
  conversationSelection,
  initialCast,
  initialConversations,
  storyEditor,
  interviewer,
  room,
  pieceAdapters,
  roster,
  runtime,
  lifecycle,
  active,
  onSwitchToSurface,
  onOpenPieces,
  onOpenModels,
  onTextChange,
  onSaveFailedChange,
  onFlushRegister,
  documents,
}: MountedProps & { readonly document: MountedDocument }) {
  const { surface, session } = document
  const conversation = useConversationSession(initialConversationId, conversationSelection)
  const cast = useSurfaceCast(pieceId, surface, initialCast, pieceAdapters)
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
    { handle: interviewer.handle, displayName: interviewer.displayName },
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

  const reading = document.kind === 'prose' && document.session.manuscript.view === 'reading'

  return (
    <div className={styles.surfacePane} hidden={!active} inert={!active}>
      {document.kind === 'prose' ? (
        <Manuscript
          title={title}
          mode={mode}
          namesMode={namesMode}
          onOpenPieces={onOpenPieces}
          onOpenModels={onOpenModels}
          manuscript={document.session.manuscript}
          location={document.location}
          autosave={session.autosave}
          onSwitchTo={onSwitchToSurface}
          lifecycle={lifecycle}
          applying={conversation.applying}
        />
      ) : (
        <ContextSurface
          surface={document.surface}
          title={title}
          onOpenPieces={onOpenPieces}
          onOpenModels={onOpenModels}
          text={document.session.text}
          location={document.location}
          onChange={document.session.setText}
          referenceSchema={document.referenceSchema}
          autosave={session.autosave}
          onSwitchTo={onSwitchToSurface}
          lifecycle={lifecycle}
          applying={conversation.applying}
          onReverseApplication={document.session.reverseApplication}
        />
      )}
      {roster.settled && (
        <div className={styles.surfacePane} hidden={reading} inert={reading}>
          <Conversation
            key={conversation.session}
            pieceId={pieceId}
            surface={surface}
            currentConversationId={conversation.activeConversationId}
            documents={documents}
            flushDocument={session.autosave.flush}
            room={room}
            identify={roster.identify}
            handles={handles}
            interviewer={interviewer}
            runtime={runtime}
            clock={Date.now}
            onApplied={session.install}
            onApplyingChange={conversation.setApplying}
            onConversationIdChange={conversation.setActiveConversationId}
            onOpenRoom={() => setPanel('room')}
            onOpenConversations={openConversations}
          />
        </div>
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
