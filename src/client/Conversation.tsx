import * as Ariakit from '@ariakit/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppliedChangeContent } from '../shared/appliedChange.js'
import { openingWords } from '../shared/conversationEntries.js'
import type { ApplicationEntryView, ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { Clock } from '../shared/clock.js'
import type { DispatchActivitySnapshot } from '../shared/conversationEvents.js'
import type { InterviewerView } from '../shared/pieceViews.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import { countWords } from '../shared/storyLength.js'
import type { AutosaveState } from './autosave.js'
import { elapsed, facts, machineWords, wordCount } from './facts.js'
import styles from './Conversation.module.css'
import { Mark } from './Mark.js'
import { isParticipantOutcome } from './entryProjection.js'
import { completeMention, mentionQuery, type MentionQuery } from './mentionTrigger.js'
import { useApply, type ApplyingResponse } from './useApply.js'
import { useNow } from './useNow.js'
import { type RoomAdapters, useConversation } from './useConversation.js'

const REVIEW_CHANGE_MESSAGE = 'Take a look at the change I just made and tell me what you think.'

const MAX_MENTION_MATCHES = 8

export type HandleEntry = Readonly<{ handle: string; displayName: string }>

type ConversationProps = {
  readonly pieceId: string
  readonly surface: SurfaceId
  readonly currentConversationId: string | null
  readonly documents: DocumentSnapshot
  readonly flushDocument: () => Promise<AutosaveState>
  readonly room: RoomAdapters
  readonly displayName: (participantId: string) => string
  readonly handle: (participantId: string) => string | undefined
  readonly mark: (participantId: string) => string | null
  readonly ordinal: (participantId: string) => number | null
  readonly handles: readonly HandleEntry[]
  /** Whom the composer's own affordance addresses, and in what words — both content, neither this module's. */
  readonly interviewer: InterviewerView
  readonly runtime: { readonly reachable: boolean } | undefined
  readonly clock: Clock
  /** The surface's one persistence writer: what an Apply installs its replacement through. */
  readonly onApplied: (text: string) => Promise<AutosaveState>
  readonly onApplyingChange?: (applying: { readonly participantName?: string; readonly abandon: () => void } | undefined) => void
  readonly onConversationIdChange?: (conversationId: string) => void
  readonly onOpenRoom: () => void
  readonly onOpenConversations: () => void
}

const ROOM_UNAVAILABLE = 'No model is reachable. The manuscript is yours to write.'

function ResponseActions({
  responseId,
  participantId,
  participantName,
  outcome,
  disabled,
  onApply,
  onAsk,
  onReplyEmpty,
  onReply,
}: {
  readonly responseId: string
  readonly participantId: string
  readonly participantName: string
  readonly outcome: 'commentary' | 'applicableSuggestion' | 'failed'
  readonly disabled: boolean
  readonly onApply: (responseId: string, constraint: string | undefined) => void
  readonly onAsk: (responseId: string, clarification: string | undefined) => void
  readonly onReplyEmpty: (participantId: string) => void
  readonly onReply: (participantId: string, message: string) => void
}) {
  const [text, setText] = useState('')
  const trimmed = text.trim()
  const withText = trimmed.length > 0

  function reply(): void {
    if (!withText) {
      onReplyEmpty(participantId)
      return
    }
    if (disabled) return
    onReply(participantId, trimmed)
    setText('')
  }

  function apply(): void {
    if (disabled) return
    onApply(responseId, withText ? trimmed : undefined)
    setText('')
  }

  function ask(): void {
    if (disabled) return
    onAsk(responseId, withText ? trimmed : undefined)
    setText('')
  }

  const fieldLabel =
    outcome === 'applicableSuggestion'
      ? 'Reply or apply, in your own words'
      : outcome === 'commentary'
        ? 'Reply or ask for a concrete change, in your own words'
        : 'Reply, in your own words'

  return (
    <div className={styles.actions} role="group" aria-label={`${participantName}'s answer`}>
      {outcome === 'applicableSuggestion' && (
        <button type="button" className={styles.applyButton} disabled={disabled} onClick={apply}>
          apply
        </button>
      )}
      {outcome === 'commentary' && (
        <button type="button" className={styles.actionButton} disabled={disabled} onClick={ask}>
          ask for a concrete change
        </button>
      )}
      <button type="button" className={styles.actionButton} disabled={withText && disabled} onClick={reply}>
        reply
      </button>
      <input
        aria-label={fieldLabel}
        className={styles.actionField}
        value={text}
        placeholder="in your words — optional"
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  )
}

function ApplyingFlight() {
  return (
    <div className={styles.apply}>
      <span className={styles.applyingFacts}>APPLYING</span>
    </div>
  )
}

function AppliedChangeView({
  content,
  askDisabled,
  onAskAboutChange,
}: {
  readonly content: AppliedChangeContent | undefined
  readonly askDisabled: boolean
  readonly onAskAboutChange: () => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className={styles.change}>
      {content === undefined ? (
        <span className={styles.changeFacts}>{facts(machineWords('applied'), machineWords('change file missing'))}</span>
      ) : content.kind === 'rewrittenWhole' ? (
        <span className={styles.changeFacts}>{facts(machineWords('applied'), machineWords('rewritten whole'))}</span>
      ) : (
        <>
          <button type="button" className={styles.changeToggle} aria-expanded={open} onClick={() => setOpen((was) => !was)}>
            {facts(machineWords('applied'), wordCount(content.passages.reduce((sum, passage) => sum + countWords(passage.after), 0)))}
          </button>
          {open && (
            <div className={styles.changeDiff}>
              {content.passages.map((passage, index) => (
                <div key={index} className={styles.changePassage}>
                  <p className={styles.changeBefore}>{passage.before}</p>
                  <p className={styles.changeAfter}>{passage.after}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <button type="button" className={styles.changeAsk} disabled={askDisabled} onClick={onAskAboutChange}>
        ask the room about this
      </button>
    </div>
  )
}

function roomChangedText(names: readonly string[]): string {
  const [only] = names
  if (names.length === 1 && only !== undefined) return `${only} was addressed and is now in the room.`
  return `${names.join(', ')} were addressed and are now in the room.`
}

function RoomChanged({ names }: { readonly names: readonly string[] }) {
  return (
    <div className={styles.roomChanged}>
      <span className={styles.roomChangedFacts}>ROOM CHANGED</span>
      <span className={styles.roomChangedWords}>{roomChangedText(names)}</span>
    </div>
  )
}

function askedText(name: string): string {
  return `${name} was asked for a concrete change.`
}

function participantNameFor(entries: readonly ConversationEntryView[], responseId: string, displayName: (id: string) => string): string {
  const entry = entries.find((candidate) => candidate.id === responseId)
  return displayName(entry?.kind === 'participantResponse' ? entry.participantId : responseId)
}

const EMPTY_APPLICATIONS: readonly ApplicationEntryView[] = []

type EntryActions = Readonly<{
  displayName: (id: string) => string
  handle: (id: string) => string | undefined
  mark: (id: string) => string | null
  ordinal: (id: string) => number | null
  applying: ApplyingResponse | undefined
  applyDisabled: boolean
  applicationsFor: (responseId: string) => readonly ApplicationEntryView[]
  onApply: (responseId: string, constraint: string | undefined) => void
  onAskAboutChange: () => void
  onReplyEmpty: (participantId: string) => void
  onReply: (participantId: string, message: string) => void
  onAsk: (responseId: string, clarification: string | undefined) => void
}>

function ParticipantIdentity({
  name,
  handle,
  mark,
  ordinal,
  status,
}: {
  readonly name: string
  readonly handle: string | undefined
  readonly mark: string | null
  readonly ordinal: number | null
  readonly status?: string
}) {
  return (
    <div className={styles.identity}>
      <Mark mark={mark} ordinal={ordinal} />
      {handle !== undefined && <span className={styles.handle}>@{handle}</span>}
      <span className={styles.name}>{name}</span>
      {status !== undefined && (
        <>
          <span className={styles.identitySpacer} />
          <span className={styles.identityStatus}>{status}</span>
        </>
      )}
    </div>
  )
}

/**
 * A conforming claim is not a short one, so the column's scannability cannot depend on the
 * participant's restraint: the claim has a ceiling and the rest is one action away. Nothing is
 * rewritten, nothing moves to the note, and the ceiling only shows itself where it is reached.
 */
function Claim({ text }: { readonly text: string }) {
  const [open, setOpen] = useState(false)
  const [beyondTheCeiling, setBeyondTheCeiling] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (open || element === null) return
    setBeyondTheCeiling(element.scrollHeight > element.clientHeight + 1)
  }, [text, open])

  return (
    <>
      <p ref={ref} className={open ? styles.claim : `${styles.claim} ${styles.claimClamped}`}>
        {text}
      </p>
      {beyondTheCeiling && (
        <button type="button" className={styles.claimMore} aria-expanded={open} onClick={() => setOpen((was) => !was)}>
          {machineWords(open ? 'less' : 'more')}
        </button>
      )}
    </>
  )
}

function EntryView({ entry, actions }: { readonly entry: ConversationEntryView; readonly actions: EntryActions }) {
  const {
    displayName,
    handle,
    mark,
    ordinal,
    applying,
    applyDisabled,
    applicationsFor,
    onApply,
    onAskAboutChange,
    onReplyEmpty,
    onReply,
    onAsk,
  } = actions

  switch (entry.kind) {
    case 'authorMessage':
      return (
        <>
          <p className={styles.message}>{entry.text}</p>
          {entry.brought.length > 0 && <RoomChanged names={entry.brought.map(displayName)} />}
        </>
      )
    case 'concreteChangeRequest':
      return (
        <>
          <div className={styles.asked}>
            <span className={styles.askedFacts}>{machineWords('asked')}</span>
            <span className={styles.askedWords}>{askedText(displayName(entry.target))}</span>
          </div>
          {entry.clarification !== undefined && <p className={styles.message}>{entry.clarification}</p>}
        </>
      )
    case 'participantNoComment':
      return (
        <div className={styles.noComment}>
          <ParticipantIdentity
            name={displayName(entry.participantId)}
            handle={handle(entry.participantId)}
            mark={mark(entry.participantId)}
            ordinal={ordinal(entry.participantId)}
          />
          <p className={styles.noCommentWords}>has no comment.</p>
        </div>
      )
    case 'participantFailure':
      return (
        <div className={styles.participant}>
          <ParticipantIdentity
            name={displayName(entry.participantId)}
            handle={handle(entry.participantId)}
            mark={mark(entry.participantId)}
            ordinal={ordinal(entry.participantId)}
          />
          <p className={styles.failed}>did not answer — {machineWords(entry.reason)}</p>
          {entry.returned !== undefined && <p className={styles.returned}>{entry.returned}</p>}
          <ResponseActions
            responseId={entry.id}
            participantId={entry.participantId}
            participantName={displayName(entry.participantId)}
            outcome="failed"
            disabled={applyDisabled}
            onApply={onApply}
            onAsk={onAsk}
            onReplyEmpty={onReplyEmpty}
            onReply={onReply}
          />
        </div>
      )
    case 'participantResponse': {
      const applyingThis = applying?.responseId === entry.id
      const applications = applicationsFor(entry.id)
      return (
        <div className={styles.participant}>
          <ParticipantIdentity
            name={displayName(entry.participantId)}
            handle={handle(entry.participantId)}
            mark={mark(entry.participantId)}
            ordinal={ordinal(entry.participantId)}
          />
          <Claim text={entry.claim} />
          {entry.note !== undefined && <p className={styles.note}>{entry.note}</p>}
          {applications.map((application) => (
            <AppliedChangeView key={application.id} content={application.change} askDisabled={applyDisabled} onAskAboutChange={onAskAboutChange} />
          ))}
          {applyingThis ? (
            <ApplyingFlight />
          ) : (
            <ResponseActions
              responseId={entry.id}
              participantId={entry.participantId}
              participantName={displayName(entry.participantId)}
              outcome={entry.outcome}
              disabled={applyDisabled}
              onApply={onApply}
              onAsk={onAsk}
              onReplyEmpty={onReplyEmpty}
              onReply={onReply}
            />
          )}
        </div>
      )
    }
    case 'application':
      return null
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}

function participantStatus(state: DispatchActivitySnapshot['states'][string] | undefined, nowMs: number): string {
  if (state === undefined) return machineWords('queued')
  return facts(machineWords(state.state), elapsed(state.startedAt, nowMs))
}

function ParticipantFlightLine({
  participantId,
  displayName,
  handle,
  mark,
  ordinal,
  state,
  nowMs,
}: {
  readonly participantId: string
  readonly displayName: (participantId: string) => string
  readonly handle: (participantId: string) => string | undefined
  readonly mark: (participantId: string) => string | null
  readonly ordinal: (participantId: string) => number | null
  readonly state: DispatchActivitySnapshot['states'][string] | undefined
  readonly nowMs: number
}) {
  return (
    <div className={`${styles.participant} ${styles.pending}`}>
      <ParticipantIdentity
        name={displayName(participantId)}
        handle={handle(participantId)}
        mark={mark(participantId)}
        ordinal={ordinal(participantId)}
        status={participantStatus(state, nowMs)}
      />
    </div>
  )
}

export function Conversation({
  pieceId,
  surface,
  currentConversationId,
  documents,
  flushDocument,
  room,
  displayName,
  handle,
  mark,
  ordinal,
  handles,
  interviewer,
  runtime,
  clock,
  onApplied,
  onApplyingChange = () => {},
  onConversationIdChange = () => {},
  onOpenRoom,
  onOpenConversations,
}: ConversationProps) {
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState<MentionQuery | undefined>(undefined)
  const [caretOffset, setCaretOffset] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const combobox = Ariakit.useComboboxStore()
  const token = Ariakit.useStoreState(combobox, 'inputValue')

  const matches = useMemo(
    () => (query === undefined ? [] : handles.filter((entry) => entry.handle.startsWith(token.toLowerCase())).slice(0, MAX_MENTION_MATCHES)),
    [handles, query, token],
  )

  useLayoutEffect(() => {
    combobox.setOpen(matches.length > 0)
  }, [combobox, matches.length])

  useLayoutEffect(() => {
    if (caretOffset === null) return
    textareaRef.current?.setSelectionRange(caretOffset, caretOffset)
  }, [caretOffset])

  const conversation = useConversation(pieceId, surface, currentConversationId, flushDocument, () => documents, room)

  const apply = useApply(pieceId, surface, conversation.conversationId, () => documents, onApplied, room, conversation.resumedApplying)

  useEffect(() => {
    onApplyingChange(
      apply.applying !== undefined
        ? {
            participantName: participantNameFor(conversation.projection.entries, apply.applying.responseId, displayName),
            abandon: () => void abandonCurrentAction(),
          }
        : conversation.applyingInRoom
          ? { abandon: () => void abandonCurrentAction() }
          : undefined,
    )
  }, [apply.applying, conversation.applyingInRoom, conversation.projection.entries, displayName, onApplyingChange])

  async function abandonCurrentAction(): Promise<void> {
    if (await conversation.abandon()) apply.clear()
  }

  const applicationsByResponse = useMemo(() => {
    const map = new Map<string, ApplicationEntryView[]>()
    for (const entry of conversation.projection.entries) {
      if (entry.kind !== 'application') continue
      const list = map.get(entry.responseId)
      if (list === undefined) map.set(entry.responseId, [entry])
      else list.push(entry)
    }
    return map
  }, [conversation.projection.entries])

  function applicationsFor(responseId: string): readonly ApplicationEntryView[] {
    return applicationsByResponse.get(responseId) ?? EMPTY_APPLICATIONS
  }

  useEffect(() => {
    if (conversation.conversationId !== null) onConversationIdChange(conversation.conversationId)
  }, [conversation.conversationId, onConversationIdChange])

  const nowMs = useNow(conversation.projection.activity !== undefined, clock)
  const activity = conversation.projection.activity
  const pendingParticipants = useMemo(() => {
    if (activity === undefined) return []
    const answered = new Set(
      conversation.projection.entries
        .filter(isParticipantOutcome)
        .filter((entry) => entry.causeId === activity.sourceEntryId)
        .map((entry) => entry.participantId),
    )
    return activity.audience.filter((participantId) => !answered.has(participantId))
  }, [activity, conversation.projection.entries])
  const roomBusy = conversation.busy || apply.applying !== undefined
  // A dispatch — a message, a reply, or a concrete-change request — is what turns the send
  // control into stop; an Apply holds the document instead, and abandoning it is the held
  // banner's control. `activity` is set only once a dispatch is confirmed under way, so the
  // control never relabels itself during the moment the surface is still learning what, if
  // anything, the room already has in flight.
  const conversationActionInFlight = activity !== undefined
  const opening = openingWords(conversation.projection.entries)

  function askAboutChange(): void {
    if (roomBusy) return
    conversation.sendMessage(REVIEW_CHANGE_MESSAGE)
  }

  // The message an author could have typed by hand, sent and recorded on the same terms as any other.
  function askTheInterviewer(): void {
    if (roomBusy) return
    conversation.sendMessage(`@${interviewer.handle} ${interviewer.invocation}`)
  }

  function replyEmpty(participantId: string): void {
    const participantHandle = handle(participantId)
    if (participantHandle === undefined) return
    const prefix = `@${participantHandle} `
    const next = message.startsWith(prefix) ? message : `${prefix}${message}`
    setMessage(next)
    setCaretOffset(next.length)
    textareaRef.current?.focus()
  }

  function reply(participantId: string, text: string): void {
    if (roomBusy) return
    conversation.reply(participantId, text)
  }

  function askForConcreteChange(responseId: string, clarification: string | undefined): void {
    if (roomBusy) return
    conversation.askForConcreteChange(responseId, clarification)
  }

  function submit() {
    const text = message.trim()
    if (text.length === 0 || roomBusy) return
    conversation.sendMessage(text)
    setMessage('')
  }

  function selectHandle(handle: string) {
    if (query === undefined) return
    const completed = completeMention(message, query, handle)
    setQuery(undefined)
    combobox.setInputValue('')
    combobox.hide()
    setMessage(completed.value)
    setCaretOffset(completed.caret)
    textareaRef.current?.focus()
  }

  const actions: EntryActions = {
    displayName,
    handle,
    mark,
    ordinal,
    applying: apply.applying,
    applyDisabled: roomBusy,
    applicationsFor,
    onApply: apply.apply,
    onAskAboutChange: askAboutChange,
    onReplyEmpty: replyEmpty,
    onReply: reply,
    onAsk: askForConcreteChange,
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerOpening}>{opening}</span>
        <span className={styles.headerSpacer} />
        <div className={styles.headerControls}>
          <button type="button" className={styles.headerControl} onClick={onOpenConversations}>
            conversations
          </button>
          <button type="button" className={styles.headerControl} onClick={onOpenRoom}>
            room
          </button>
        </div>
      </div>
      <div className={styles.transcript}>
        {conversation.projection.entries.map((entry) => (
          <EntryView key={entry.id} entry={entry} actions={actions} />
        ))}
        {pendingParticipants.map((participantId) => (
          <ParticipantFlightLine
            key={participantId}
            participantId={participantId}
            displayName={displayName}
            handle={handle}
            mark={mark}
            ordinal={ordinal}
            state={activity?.states[participantId]}
            nowMs={nowMs}
          />
        ))}
      </div>
      {(conversation.error ?? apply.error) !== undefined && (
        <p className={styles.error} role="alert">
          {conversation.error ?? apply.error}
        </p>
      )}
      {runtime?.reachable === false && (
        <div className={styles.unavailable}>
          <span className={styles.unavailableFacts}>ROOM UNAVAILABLE</span>
          <span className={styles.unavailableWords}>{ROOM_UNAVAILABLE}</span>
        </div>
      )}
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        onKeyDown={(event) => {
          // Placed on the form rather than the textarea itself: the mention combobox's own
          // handling of Enter runs on the textarea during the same bubble phase, and only by
          // running after it here does `defaultPrevented` already say whether it claimed the key.
          if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return
          event.preventDefault()
          submit()
        }}
      >
        <label className={styles.visuallyHidden} htmlFor={`conversation-message-${surface}`}>
          Message the room
        </label>
        <div className={styles.field}>
          {/* `value` carries the whole message; the store's own `inputValue` holds only the live `@token`. */}
          <Ariakit.Combobox
            id={`conversation-message-${surface}`}
            store={combobox}
            className={styles.input}
            value={message}
            showOnClick={false}
            showOnChange={false}
            showOnKeyPress={false}
            setValueOnChange={false}
            render={
              <textarea
                ref={textareaRef}
                rows={2}
                onPointerDown={combobox.hide}
                onChange={(event) => {
                  const textarea = event.target
                  const next = mentionQuery(textarea.value, textarea.selectionStart ?? textarea.value.length)
                  setQuery(next)
                  setMessage(textarea.value)
                  combobox.setInputValue(next?.token ?? '')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') combobox.hide()
                }}
              />
            }
          />
          <Ariakit.ComboboxPopover store={combobox} hidden={matches.length === 0} unmountOnHide gutter={4} className={styles.mentions}>
            {matches.map((entry) => (
              <Ariakit.ComboboxItem
                key={entry.handle}
                value={entry.handle}
                focusOnHover
                className={styles.mention}
                onClick={() => selectHandle(entry.handle)}
              >
                <span className={styles.mentionHandle}>@{entry.handle}</span>
                <span className={styles.mentionName}>{entry.displayName}</span>
              </Ariakit.ComboboxItem>
            ))}
          </Ariakit.ComboboxPopover>
        </div>
        <button type="button" className={styles.interview} disabled={roomBusy} onClick={askTheInterviewer}>
          ask me
        </button>
        {conversationActionInFlight ? (
          <button type="button" className={styles.send} onClick={() => void abandonCurrentAction()}>
            stop
          </button>
        ) : (
          <button type="submit" className={styles.send} disabled={roomBusy || message.trim().length === 0}>
            send
          </button>
        )}
      </form>
    </div>
  )
}
