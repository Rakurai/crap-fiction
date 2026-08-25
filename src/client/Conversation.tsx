import * as Ariakit from '@ariakit/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppliedChangeContent } from '../shared/appliedChange.js'
import type { ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { Clock } from '../shared/clock.js'
import type { DispatchActivitySnapshot } from '../shared/conversationEvents.js'
import { countWords } from '../shared/storyLength.js'
import { elapsed, facts, machineWords, wordCount } from './facts.js'
import styles from './Conversation.module.css'
import { tallyActivity } from './entryProjection.js'
import { completeMention, mentionQuery, type MentionQuery } from './mentionTrigger.js'
import { useApply, type ApplyingResponse } from './useApply.js'
import type { HandleEntry } from './useRoster.js'
import { useNow } from './useNow.js'
import { type RoomAdapters, useConversation } from './useConversation.js'

const REVIEW_CHANGE_MESSAGE = 'Take a look at the change I just made and tell me what you think.'

const MAX_MENTION_MATCHES = 8

type ConversationProps = {
  readonly pieceId: string
  readonly currentConversationId: string | null
  readonly conversationActionInFlight: DispatchActivitySnapshot | null
  readonly draft: string
  readonly flushDraft: () => void
  readonly room: RoomAdapters
  readonly displayName: (participantId: string) => string
  readonly mark: (participantId: string) => string
  readonly handle: (participantId: string) => string | undefined
  readonly handles: readonly HandleEntry[]
  readonly runtime: { readonly reachable: boolean } | undefined
  readonly clock: Clock
  readonly onApplied?: (markdown: string) => void
  readonly onApplyingChange?: (applying: boolean) => void
  readonly onConversationIdChange?: (conversationId: string) => void
}

const ROOM_UNAVAILABLE = 'No model is reachable. The manuscript is yours to write.'

function ApplyAction({
  responseId,
  disabled,
  onApply,
}: {
  readonly responseId: string
  readonly disabled: boolean
  readonly onApply: (responseId: string, constraint: string | undefined) => void
}) {
  const [constraint, setConstraint] = useState('')

  return (
    <div className={styles.apply}>
      <input
        aria-label="Constraint for applying this recommendation"
        className={styles.applyConstraint}
        value={constraint}
        disabled={disabled}
        placeholder="a constraint, if there is one"
        onChange={(event) => setConstraint(event.target.value)}
      />
      <button
        type="button"
        className={styles.applyButton}
        disabled={disabled}
        onClick={() => onApply(responseId, constraint.trim().length > 0 ? constraint.trim() : undefined)}
      >
        apply
      </button>
    </div>
  )
}

function ReplyAction({
  participantId,
  busy,
  onReplyEmpty,
  onReply,
}: {
  readonly participantId: string
  readonly busy: boolean
  readonly onReplyEmpty: (participantId: string) => void
  readonly onReply: (participantId: string, message: string) => void
}) {
  const [text, setText] = useState('')
  const blocked = text.trim().length > 0 && busy

  function submit(): void {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      onReplyEmpty(participantId)
      return
    }
    if (busy) return
    onReply(participantId, trimmed)
    setText('')
  }

  return (
    <div className={styles.actions}>
      <input
        aria-label="Reply, in your own words"
        className={styles.actionField}
        value={text}
        placeholder="in your words — optional"
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" className={styles.actionButton} disabled={blocked} onClick={submit}>
        reply
      </button>
    </div>
  )
}

function AskAction({
  responseId,
  disabled,
  onAsk,
}: {
  readonly responseId: string
  readonly disabled: boolean
  readonly onAsk: (responseId: string, clarification: string | undefined) => void
}) {
  const [clarification, setClarification] = useState('')

  return (
    <div className={styles.actions}>
      <input
        aria-label="Clarify what you're asking for"
        className={styles.actionField}
        value={clarification}
        disabled={disabled}
        placeholder="a clarification, if there is one"
        onChange={(event) => setClarification(event.target.value)}
      />
      <button
        type="button"
        className={styles.actionButton}
        disabled={disabled}
        onClick={() => onAsk(responseId, clarification.trim().length > 0 ? clarification.trim() : undefined)}
      >
        ask for a concrete change
      </button>
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
  readonly content: AppliedChangeContent
  readonly askDisabled: boolean
  readonly onAskAboutChange: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.change}>
      {content.kind === 'rewrittenWhole' ? (
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

type EntryActions = Readonly<{
  displayName: (id: string) => string
  mark: (id: string) => string
  applying: ApplyingResponse | undefined
  applyDisabled: boolean
  onApply: (responseId: string, constraint: string | undefined) => void
  onAbandonApply: () => void
  onAskAboutChange: () => void
  onReplyEmpty: (participantId: string) => void
  onReply: (participantId: string, message: string) => void
  onAsk: (responseId: string, clarification: string | undefined) => void
}>

function ParticipantIdentity({ name, mark }: { readonly name: string; readonly mark: string }) {
  return (
    <div className={styles.identity}>
      <span className={styles.mark} style={{ background: mark }} aria-hidden="true" />
      <span className={styles.name}>{name}</span>
    </div>
  )
}

function EntryView({ entry, actions }: { readonly entry: ConversationEntryView; readonly actions: EntryActions }) {
  const { displayName, mark, applying, applyDisabled, onApply, onAbandonApply, onAskAboutChange, onReplyEmpty, onReply, onAsk } = actions

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
          <ParticipantIdentity name={displayName(entry.participantId)} mark={mark(entry.participantId)} />
          <p className={styles.failed}>did not answer — {machineWords(entry.reason)}</p>
          {entry.returned !== undefined && <p className={styles.returned}>{entry.returned}</p>}
          <ReplyAction participantId={entry.participantId} busy={applyDisabled} onReplyEmpty={onReplyEmpty} onReply={onReply} />
        </div>
      )
    case 'participantResponse': {
      const recommends = entry.outcome === 'applicableSuggestion'
      const offeredAReading = entry.outcome === 'commentary'
      const applyingThis = applying?.responseId === entry.id
      return (
        <div className={styles.participant}>
          <ParticipantIdentity name={displayName(entry.participantId)} mark={mark(entry.participantId)} />
          <p className={styles.claim}>{entry.claim}</p>
          {entry.note !== undefined && <p className={styles.note}>{entry.note}</p>}
          {recommends &&
            (applyingThis ? <ApplyingFlight onAbandon={onAbandonApply} /> : <ApplyAction responseId={entry.id} disabled={applyDisabled} onApply={onApply} />)}
          {offeredAReading && <AskAction responseId={entry.id} disabled={applyDisabled} onAsk={onAsk} />}
          <ReplyAction participantId={entry.participantId} busy={applyDisabled} onReplyEmpty={onReplyEmpty} onReply={onReply} />
        </div>
      )
    }
    case 'application':
      return entry.change === undefined ? null : <AppliedChangeView content={entry.change} askDisabled={applyDisabled} onAskAboutChange={onAskAboutChange} />
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}

function activityFacts(activity: DispatchActivitySnapshot, entries: readonly ConversationEntryView[], nowMs: number): string {
  const tally = tallyActivity(activity, entries)
  const counts = [
    [tally.working, 'WORKING'],
    [tally.preparing, 'PREPARING'],
    [tally.answered, 'ANSWERED'],
    [tally.waiting, 'WAITING'],
  ] as const
  const said = counts.filter(([count]) => count > 0).map(([count, noun]) => `${count} ${noun}`)
  return facts(...said, elapsed(activity.startedAt, nowMs))
}

function DispatchFlight({
  activity,
  entries,
  nowMs,
  onAbandon,
}: {
  readonly activity: DispatchActivitySnapshot
  readonly entries: readonly ConversationEntryView[]
  readonly nowMs: number
  readonly onAbandon: () => void
}) {
  return (
    <div className={styles.flight}>
      <span className={styles.roundFacts}>{activityFacts(activity, entries, nowMs)}</span>
      <button type="button" className={styles.abandon} onClick={onAbandon}>
        abandon
      </button>
    </div>
  )
}

export function Conversation({
  pieceId,
  currentConversationId,
  conversationActionInFlight,
  draft,
  flushDraft,
  room,
  displayName,
  mark,
  handle,
  handles,
  runtime,
  clock,
  onApplied = () => {},
  onApplyingChange = () => {},
  onConversationIdChange = () => {},
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

  const conversation = useConversation(pieceId, currentConversationId, conversationActionInFlight, flushDraft, () => draft, room)
  const apply = useApply(pieceId, conversation.conversationId, () => draft, onApplied, onApplyingChange, conversation.attachEntry, room)

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
    mark,
    applying: apply.applying,
    applyDisabled: roomBusy,
    onApply: apply.apply,
    onAbandonApply: apply.abandon,
    onAskAboutChange: askAboutChange,
    onReplyEmpty: replyEmpty,
    onReply: reply,
    onAsk: askForConcreteChange,
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.rounds}>
        {conversation.projection.entries.map((entry) => (
          <EntryView key={entry.id} entry={entry} actions={actions} />
        ))}
        {conversation.projection.activity !== undefined && (
          <DispatchFlight activity={conversation.projection.activity} entries={conversation.projection.entries} nowMs={nowMs} onAbandon={conversation.abandon} />
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
        <label className={styles.visuallyHidden} htmlFor="conversation-message">
          Message the room
        </label>
        <div className={styles.field}>
          {/* `value` carries the whole message; the store's own `inputValue` holds only the live `@token`. */}
          <Ariakit.Combobox
            id="conversation-message"
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
          {conversation.busy ? '…' : 'send'}
        </button>
      </form>
    </div>
  )
}
