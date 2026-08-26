import * as Ariakit from '@ariakit/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppliedChangeContent } from '../shared/appliedChange.js'
import type { ApplicationEntryView, ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { Clock } from '../shared/clock.js'
import type { DispatchActivitySnapshot } from '../shared/conversationEvents.js'
import type { DocumentSnapshot, PieceSurfaceId } from '../shared/surfaces.js'
import { countWords } from '../shared/storyLength.js'
import { elapsed, facts, machineWords, wordCount } from './facts.js'
import styles from './Conversation.module.css'
import { completeMention, mentionQuery, type MentionQuery } from './mentionTrigger.js'
import { useApply, type ApplyingResponse } from './useApply.js'
import { useNow } from './useNow.js'
import { type RoomAdapters, useConversation } from './useConversation.js'

const REVIEW_CHANGE_MESSAGE = 'Take a look at the change I just made and tell me what you think.'

const MAX_MENTION_MATCHES = 8

export type HandleEntry = Readonly<{ handle: string; displayName: string }>

type ConversationProps = {
  readonly pieceId: string
  readonly surface: PieceSurfaceId
  readonly currentConversationId: string | null
  readonly documents: DocumentSnapshot
  readonly flushDocument: () => void
  readonly room: RoomAdapters
  readonly displayName: (participantId: string) => string
  readonly handle: (participantId: string) => string | undefined
  readonly handles: readonly HandleEntry[]
  readonly runtime: { readonly reachable: boolean } | undefined
  readonly clock: Clock
  readonly onApplied?: (markdown: string) => void
  readonly onApplyingChange?: (applying: { readonly participantName: string } | undefined) => void
  readonly onConversationIdChange?: (conversationId: string) => void
  readonly onActionIdChange?: (action: { readonly conversationId: string; readonly actionId: string } | undefined) => void
}

const ROOM_UNAVAILABLE = 'No model is reachable. The manuscript is yours to write.'

function ResponseActions({
  responseId,
  participantId,
  outcome,
  disabled,
  onApply,
  onAsk,
  onReplyEmpty,
  onReply,
}: {
  readonly responseId: string
  readonly participantId: string
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
    <div className={styles.actions}>
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

function ApplyingFlight({ onAbandon }: { readonly onAbandon: () => void }) {
  return (
    <div className={styles.apply}>
      <span className={styles.applyingFacts}>APPLYING</span>
      <button type="button" className={styles.abandon} onClick={onAbandon}>
        abandon
      </button>
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
  applying: ApplyingResponse | undefined
  applyDisabled: boolean
  applicationsFor: (responseId: string) => readonly ApplicationEntryView[]
  onApply: (responseId: string, constraint: string | undefined) => void
  onAbandonApply: () => void
  onAskAboutChange: () => void
  onReplyEmpty: (participantId: string) => void
  onReply: (participantId: string, message: string) => void
  onAsk: (responseId: string, clarification: string | undefined) => void
}>

function ParticipantIdentity({ name, handle }: { readonly name: string; readonly handle: string | undefined }) {
  return (
    <div className={styles.identity}>
      {handle !== undefined && <span className={styles.handle}>@{handle}</span>}
      <span className={styles.name}>{name}</span>
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
  const { displayName, handle, applying, applyDisabled, applicationsFor, onApply, onAbandonApply, onAskAboutChange, onReplyEmpty, onReply, onAsk } =
    actions

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
      return null
    case 'participantFailure':
      return (
        <div className={styles.participant}>
          <ParticipantIdentity name={displayName(entry.participantId)} handle={handle(entry.participantId)} />
          <p className={styles.failed}>did not answer — {machineWords(entry.reason)}</p>
          {entry.returned !== undefined && <p className={styles.returned}>{entry.returned}</p>}
          <ResponseActions
            responseId={entry.id}
            participantId={entry.participantId}
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
          <ParticipantIdentity name={displayName(entry.participantId)} handle={handle(entry.participantId)} />
          <Claim text={entry.claim} />
          {entry.note !== undefined && <p className={styles.note}>{entry.note}</p>}
          {applications.map((application) => (
            <AppliedChangeView key={application.id} content={application.change} askDisabled={applyDisabled} onAskAboutChange={onAskAboutChange} />
          ))}
          {applyingThis ? (
            <ApplyingFlight onAbandon={onAbandonApply} />
          ) : (
            <ResponseActions
              responseId={entry.id}
              participantId={entry.participantId}
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

function DispatchFlight({
  activity,
  displayName,
  nowMs,
  onAbandon,
}: {
  readonly activity: DispatchActivitySnapshot
  readonly displayName: (participantId: string) => string
  readonly nowMs: number
  readonly onAbandon: () => void
}) {
  const active = Object.keys(activity.states)
  return (
    <div className={styles.flightWrapper}>
      <div className={styles.flight}>
        <span className={styles.activityFacts}>{facts(machineWords('active'), elapsed(activity.startedAt, nowMs))}</span>
        <button type="button" className={styles.abandon} onClick={onAbandon}>
          abandon
        </button>
      </div>
      {active.length > 0 && (
        <ul className={styles.progress}>
          {active.map((participantId) => (
            <li key={participantId} className={styles.progressLine}>
              {displayName(participantId)} is thinking.
            </li>
          ))}
        </ul>
      )}
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
  handles,
  runtime,
  clock,
  onApplied = () => {},
  onApplyingChange = () => {},
  onConversationIdChange = () => {},
  onActionIdChange = () => {},
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
      apply.applying === undefined
        ? undefined
        : { participantName: participantNameFor(conversation.projection.entries, apply.applying.responseId, displayName) },
    )
  }, [apply.applying, conversation.projection.entries, displayName, onApplyingChange])

  function abandonCurrentAction(): void {
    conversation.abandon()
    apply.clear()
  }

  useEffect(() => {
    const conversationId = conversation.conversationId
    onActionIdChange(
      conversation.actionId === undefined || conversationId === null ? undefined : { conversationId, actionId: conversation.actionId },
    )
  }, [conversation.actionId, conversation.conversationId, onActionIdChange])

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
  const roomBusy = conversation.busy || apply.applying !== undefined

  function askAboutChange(): void {
    if (roomBusy) return
    conversation.sendMessage(REVIEW_CHANGE_MESSAGE)
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
    applying: apply.applying,
    applyDisabled: roomBusy,
    applicationsFor,
    onApply: apply.apply,
    onAbandonApply: abandonCurrentAction,
    onAskAboutChange: askAboutChange,
    onReplyEmpty: replyEmpty,
    onReply: reply,
    onAsk: askForConcreteChange,
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.transcript}>
        {conversation.projection.entries.map((entry) => (
          <EntryView key={entry.id} entry={entry} actions={actions} />
        ))}
        {conversation.projection.activity !== undefined && (
          <DispatchFlight activity={conversation.projection.activity} displayName={displayName} nowMs={nowMs} onAbandon={abandonCurrentAction} />
        )}
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
                placeholder="what isn’t working about the ending"
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
        <button type="submit" className={styles.send} disabled={roomBusy || message.trim().length === 0}>
          send
        </button>
      </form>
    </div>
  )
}
