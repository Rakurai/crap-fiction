import * as Ariakit from '@ariakit/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppliedChange } from '../shared/appliedChange.js'
import type { Clock } from '../shared/clock.js'
import { countWords } from '../shared/storyLength.js'
import { elapsed, facts, machineWords, wordCount } from './facts.js'
import styles from './Conversation.module.css'
import { completeMention, mentionQuery, type MentionQuery } from './mentionTrigger.js'
import { everyCallFailed, tallyRound, type ProjectedParticipant, type ProjectedRound } from './roundProjection.js'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import type { RuntimeStatus } from '../shared/runtimeStatus.js'
import { useApply, type ApplyingResponse } from './useApply.js'
import type { HandleEntry } from './useRoster.js'
import { useNow } from './useNow.js'
import { type RoomAdapters, useConversation } from './useConversation.js'

const REVIEW_CHANGE_MESSAGE = 'Take a look at the change I just made and tell me what you think.'

const MAX_MENTION_MATCHES = 8

type ConversationProps = {
  readonly pieceId: string
  readonly currentConversationId: string | null
  readonly roundInFlight: RoundSnapshot | null
  readonly draft: string
  readonly flushDraft: () => void
  readonly room: RoomAdapters
  readonly displayName: (participantId: string) => string
  readonly mark: (participantId: string) => string
  readonly handle: (participantId: string) => string | undefined
  readonly handles: readonly HandleEntry[]
  readonly runtime: RuntimeStatus | undefined
  readonly clock: Clock
  readonly onApplied?: (markdown: string) => void
  readonly onApplyingChange?: (applying: boolean) => void
  readonly onConversationIdChange?: (conversationId: string) => void
}

const ROOM_UNAVAILABLE = 'No model is reachable. The manuscript is yours to write.'

const NOTHING_CAME_BACK = 'Every call failed. Nothing came back, and there is no answer to show you.'

const STATE_LABEL: Record<'waiting' | 'preparing' | 'working', string> = {
  waiting: 'waiting',
  preparing: 'preparing its model',
  working: 'thinking',
}

function participantSays(participant: ProjectedParticipant): ReactNode {
  if (participant.state !== 'settled') {
    return <p className={styles.state}>{machineWords(STATE_LABEL[participant.state])}</p>
  }

  const { result } = participant
  if (result === undefined || result.kind === 'abandoned') return null
  if (result.kind === 'response' && result.outcome === 'noComment') return null

  if (result.kind === 'failed') {
    return (
      <>
        <p className={styles.failed}>did not answer — {machineWords(result.reason)}</p>
        {result.returned !== undefined && <p className={styles.returned}>{result.returned}</p>}
      </>
    )
  }

  return (
    <>
      <p className={styles.claim}>{result.claim}</p>
      {result.note !== undefined && <p className={styles.note}>{result.note}</p>}
    </>
  )
}

function ApplyAction({
  roundId,
  participantId,
  disabled,
  onApply,
}: {
  readonly roundId: string
  readonly participantId: string
  readonly disabled: boolean
  readonly onApply: (roundId: string, participantId: string, constraint: string | undefined) => void
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
        onClick={() => onApply(roundId, participantId, constraint.trim().length > 0 ? constraint.trim() : undefined)}
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
  roundId,
  participantId,
  disabled,
  onAsk,
}: {
  readonly roundId: string
  readonly participantId: string
  readonly disabled: boolean
  readonly onAsk: (roundId: string, participantId: string, clarification: string | undefined) => void
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
        onClick={() => onAsk(roundId, participantId, clarification.trim().length > 0 ? clarification.trim() : undefined)}
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
  change,
  askDisabled,
  onAskAboutChange,
}: {
  readonly change: AppliedChange
  readonly askDisabled: boolean
  readonly onAskAboutChange: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.change}>
      {change.content.kind === 'rewrittenWhole' ? (
        <span className={styles.changeFacts}>{facts(machineWords('applied'), machineWords('rewritten whole'))}</span>
      ) : (
        <>
          <button type="button" className={styles.changeToggle} aria-expanded={open} onClick={() => setOpen((was) => !was)}>
            {facts(machineWords('applied'), wordCount(change.content.passages.reduce((sum, passage) => sum + countWords(passage.after), 0)))}
          </button>
          {open && (
            <div className={styles.changeDiff}>
              {change.content.passages.map((passage, index) => (
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

function ParticipantBlock({
  participant,
  roundId,
  name,
  mark,
  applying,
  applyDisabled,
  onApply,
  onAbandonApply,
  onAskAboutChange,
  onReplyEmpty,
  onReply,
  onAsk,
}: {
  readonly participant: ProjectedParticipant
  readonly roundId: string
  readonly name: string
  readonly mark: string
  readonly applying: boolean
  readonly applyDisabled: boolean
  readonly onApply: (roundId: string, participantId: string, constraint: string | undefined) => void
  readonly onAbandonApply: () => void
  readonly onAskAboutChange: () => void
  readonly onReplyEmpty: (participantId: string) => void
  readonly onReply: (participantId: string, message: string) => void
  readonly onAsk: (roundId: string, participantId: string, clarification: string | undefined) => void
}) {
  const says = participantSays(participant)
  if (says === null) return null

  const recommends =
    participant.state === 'settled' && participant.result?.kind === 'response' && participant.result.outcome === 'applicableSuggestion'
  const offeredAReading =
    participant.state === 'settled' && participant.result?.kind === 'response' && participant.result.outcome === 'commentary'

  return (
    <div className={styles.participant}>
      <div className={styles.identity}>
        <span className={styles.mark} style={{ background: mark }} aria-hidden="true" />
        <span className={styles.name}>{name}</span>
      </div>
      {says}
      {participant.appliedChanges.map((change) => (
        <AppliedChangeView key={change.id} change={change} askDisabled={applyDisabled} onAskAboutChange={onAskAboutChange} />
      ))}
      {recommends &&
        (applying ? (
          <ApplyingFlight onAbandon={onAbandonApply} />
        ) : (
          <ApplyAction roundId={roundId} participantId={participant.participantId} disabled={applyDisabled} onApply={onApply} />
        ))}
      {offeredAReading && <AskAction roundId={roundId} participantId={participant.participantId} disabled={applyDisabled} onAsk={onAsk} />}
      <ReplyAction participantId={participant.participantId} busy={applyDisabled} onReplyEmpty={onReplyEmpty} onReply={onReply} />
    </div>
  )
}

function roundFacts(round: ProjectedRound, nowMs: number): string {
  const tally = tallyRound(round)
  const counts = [
    [tally.working, 'WORKING'],
    [tally.preparing, 'PREPARING'],
    [tally.answered, 'ANSWERED'],
    [tally.waiting, 'WAITING'],
  ] as const
  const said = counts.filter(([count]) => count > 0).map(([count, noun]) => `${count} ${noun}`)
  return facts(...said, ...(round.openedAt === undefined ? [] : [elapsed(round.openedAt, nowMs)]))
}

function roomChangedText(names: readonly string[]): string {
  const [only] = names
  if (names.length === 1 && only !== undefined) return `${only} was addressed and is now in the room.`
  return `${names.join(', ')} were addressed and are now in the room.`
}

function askedText(name: string): string {
  return `${name} was asked for a concrete change.`
}

function RoundFlight({ round, nowMs, onAbandon }: { readonly round: ProjectedRound; readonly nowMs: number; readonly onAbandon: () => void }) {
  return (
    <div className={styles.flight}>
      <span className={styles.roundFacts}>{roundFacts(round, nowMs)}</span>
      <button type="button" className={styles.abandon} onClick={onAbandon}>
        abandon
      </button>
    </div>
  )
}

function RoundView({
  round,
  nowMs,
  displayName,
  mark,
  onAbandon,
  applying,
  applyDisabled,
  onApply,
  onAbandonApply,
  onAskAboutChange,
  onReplyEmpty,
  onReply,
  onAsk,
}: {
  readonly round: ProjectedRound
  readonly nowMs: number
  readonly displayName: (id: string) => string
  readonly mark: (id: string) => string
  readonly onAbandon: () => void
  readonly applying: ApplyingResponse | undefined
  readonly applyDisabled: boolean
  readonly onApply: (roundId: string, participantId: string, constraint: string | undefined) => void
  readonly onAbandonApply: () => void
  readonly onAskAboutChange: () => void
  readonly onReplyEmpty: (participantId: string) => void
  readonly onReply: (participantId: string, message: string) => void
  readonly onAsk: (roundId: string, participantId: string, clarification: string | undefined) => void
}) {
  return (
    <div className={styles.round}>
      {round.message !== undefined && <p className={styles.message}>{round.message}</p>}
      {round.message === undefined && round.respondingTo !== undefined && (
        <div className={styles.asked}>
          <span className={styles.askedFacts}>{machineWords('asked')}</span>
          <span className={styles.askedWords}>{askedText(displayName(round.respondingTo.participantId))}</span>
        </div>
      )}
      {round.clarification !== undefined && <p className={styles.message}>{round.clarification}</p>}
      {round.brought.length > 0 && (
        <div className={styles.roomChanged}>
          <span className={styles.roomChangedFacts}>ROOM CHANGED</span>
          <span className={styles.roomChangedWords}>{roomChangedText(round.brought.map(displayName))}</span>
        </div>
      )}
      {round.outcome === 'inFlight' && <RoundFlight round={round} nowMs={nowMs} onAbandon={onAbandon} />}
      {round.participants.map((participant) => (
        <ParticipantBlock
          key={participant.participantId}
          participant={participant}
          roundId={round.roundId}
          name={displayName(participant.participantId)}
          mark={mark(participant.participantId)}
          applying={applying?.roundId === round.roundId && applying.participantId === participant.participantId}
          applyDisabled={applyDisabled}
          onApply={onApply}
          onAbandonApply={onAbandonApply}
          onAskAboutChange={onAskAboutChange}
          onReplyEmpty={onReplyEmpty}
          onReply={onReply}
          onAsk={onAsk}
        />
      ))}
      {round.outcome === 'abandoned' && <p className={styles.abandoned}>ABANDONED</p>}
      {everyCallFailed(round) && <p className={styles.nothing}>{NOTHING_CAME_BACK}</p>}
    </div>
  )
}

export function Conversation({
  pieceId,
  currentConversationId,
  roundInFlight,
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

  const conversation = useConversation(pieceId, currentConversationId, roundInFlight, flushDraft, () => draft, room)
  const apply = useApply(pieceId, conversation.conversationId, () => draft, onApplied, onApplyingChange, conversation.attachAppliedChange, room)

  useEffect(() => {
    if (conversation.conversationId !== null) onConversationIdChange(conversation.conversationId)
  }, [conversation.conversationId, onConversationIdChange])

  const counting = conversation.projection.rounds.some((round) => round.outcome === 'inFlight')
  const nowMs = useNow(counting, clock)
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

  function askForConcreteChange(roundId: string, participantId: string, clarification: string | undefined): void {
    if (roomBusy) return
    conversation.askForConcreteChange(roundId, participantId, clarification)
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.rounds}>
        {conversation.projection.rounds.map((round) => (
          <RoundView
            key={round.roundId}
            round={round}
            nowMs={nowMs}
            displayName={displayName}
            mark={mark}
            onAbandon={conversation.abandon}
            applying={apply.applying}
            applyDisabled={roomBusy}
            onApply={apply.apply}
            onAbandonApply={apply.abandon}
            onAskAboutChange={askAboutChange}
            onReplyEmpty={replyEmpty}
            onReply={reply}
            onAsk={askForConcreteChange}
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
