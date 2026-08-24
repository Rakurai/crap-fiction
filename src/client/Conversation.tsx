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

/** SPEC "Review change": a convenience for something the author could type, never a distinct mode of reasoning. */
const REVIEW_CHANGE_MESSAGE = 'Take a look at the change I just made and tell me what you think.'

/** How many suggestions the composer's own combobox offers at once, so a broad prefix does not fill the screen. */
const MAX_MENTION_MATCHES = 8

type ConversationProps = {
  readonly pieceId: string
  readonly currentConversationId: string | null
  readonly roundInFlight: RoundSnapshot | null
  readonly draft: string
  readonly flushDraft: () => void
  readonly room: RoomAdapters
  /** The room's names, resolved by the screen — this surface asks nothing about models. */
  readonly displayName: (participantId: string) => string
  /** The participant's own colour, stable for as long as the room is. */
  readonly mark: (participantId: string) => string
  /** UX_DESIGN "Actions on a response": the shipped handle for a participant, so an empty reply can address it in the main input. */
  readonly handle: (participantId: string) => string | undefined
  /** SPEC "The room": the shipped handles the composer's own combobox offers, read from the roster. */
  readonly handles: readonly HandleEntry[]
  /**
   * Whether a model can be reached, as the screen last heard it. `undefined` is
   * not "unreachable": it is nothing heard either way, and a notice drawn from it
   * would tell the author the room is down on the strength of a request that
   * failed on this end.
   */
  readonly runtime: RuntimeStatus | undefined
  /** The clock the elapsed count is read from, so a test states the moment rather than waiting for it. */
  readonly clock: Clock
  /** CONTEXT "Apply": the manuscript once an application settles — this surface knows nothing about the editor beyond handing it the result. */
  readonly onApplied?: (markdown: string) => void
  /** SPEC "Applying a recommendation": whether the manuscript's own read-only lock should be held, for the surface that draws it. */
  readonly onApplyingChange?: (applying: boolean) => void
  /** #17 "Conversations": the conversation this surface is addressing, once its first round has minted one — so the switcher beside it can tell which listing row is current without holding a second copy of the fact. */
  readonly onConversationIdChange?: (conversationId: string) => void
}

const ROOM_UNAVAILABLE = 'No model is reachable. The manuscript is yours to write.'

const NOTHING_CAME_BACK = 'Every call failed. Nothing came back, and there is no answer to show you.'

const STATE_LABEL: Record<'waiting' | 'preparing' | 'working', string> = {
  waiting: 'waiting',
  preparing: 'preparing its model',
  working: 'thinking',
}

/**
 * UX_DESIGN "Participant responses": what a response says arrives in two parts,
 * and the two are typographically distinct so the author can read a round's
 * claims down the column and stop at the ones worth the elaboration. The claim
 * is set in the prose register — a serif at full ink, sharing a family with the
 * manuscript — because that is what says a person said this; the note is the
 * interface's own register, one step quieter, in its own block. They were one
 * paragraph in one size at one ink value, which made the room's contribution
 * fainter than the author's own sentence beside it.
 *
 * `null` is what a response that occupies no space looks like: a no-comment
 * response is recorded and absent, not a dimmed placeholder, so nothing —
 * identity included — is drawn for it.
 */
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
        {/*
         * SPEC "Model access": `returned` is verbatim content where anything came
         * back at all, which is why it is shown rather than summarised and why it
         * is often absent — a call that timed out or never connected returned
         * nothing to show. Monospaced rather than upper-cased: the register it
         * belongs to is the machine's, but verbatim is the whole point, and
         * `machineWords` would rewrite the bytes it is here to show.
         */}
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

/**
 * UX_DESIGN "A round in flight": filling in order must not read as a chain, so
 * each response is a discrete block with a rule above it rather than a paragraph
 * continuing the one before. The mark carries identity and nothing else — no
 * agreement, no severity, no confidence — and is decorative to anything reading
 * the page, which has the name in text right beside it.
 */
/**
 * UX_DESIGN "Applying, and seeing what it did": the constraint field a
 * response's own Apply offers — empty applies the recommendation as written,
 * and text carries as an additional instruction verbatim (CONTEXT
 * "Constraint"). Local state because nothing above needs the draft constraint
 * until the moment Apply is pressed.
 */
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

/**
 * UX_DESIGN "Actions on a response": offered on any response, on the same
 * terms — empty, it addresses that participant in the main input and leaves
 * the author composing; with text, it sends that text immediately. Both
 * outcomes are read off the one field on the button's own click, since
 * replying and sending a reply are not different kinds of interaction.
 *
 * The field itself is never disabled: nothing about another operation being
 * in flight is a reason to stop composing a reply. Only sending is refused
 * while busy — and refused quietly, on the same terms `sendMessage` and
 * `apply` already refuse a second operation.
 */
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

/**
 * UX_DESIGN "Actions on a response": offered on a response that offered a
 * reading without an action. Empty, it asks that participant to show what it
 * would change; with text, it asks the same with the author's clarification —
 * carried to the room, never shown, on the same terms `ApplyAction`'s
 * constraint is.
 */
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

/**
 * UX_DESIGN "An operation in flight": the same register a round in flight
 * uses, drawn on the response being applied rather than merged with the
 * round's own facts line — an application is not the round that produced the
 * recommendation.
 */
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

/**
 * UX_DESIGN "Applying, and seeing what it did": the before-and-after as
 * prose, struck through and replaced, in the room's own register rather than
 * as a code diff — the author is reading sentences and judging whether they
 * are better. Disclosed on the author's own action: closed, it is a computed
 * count in the facts register, never a composed sentence, so a long change
 * is one closed line until the author wants it.
 *
 * A whole-manuscript rewrite has nothing to disclose — CONTEXT "Applied
 * change" keeps no prose for it — so it is the bare statement, with no
 * toggle to open onto content that was never kept.
 */
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
  /** Whether this exact response is the one mid-application. */
  readonly applying: boolean
  /** Whether Apply is offered at all right now — another operation already holds the room. */
  readonly applyDisabled: boolean
  readonly onApply: (roundId: string, participantId: string, constraint: string | undefined) => void
  readonly onAbandonApply: () => void
  /** CONTEXT "Applied change": asking the room about a change is an ordinary message the author does not have to compose. */
  readonly onAskAboutChange: () => void
  /** UX_DESIGN "Actions on a response": Reply, empty — addresses the participant in the main input rather than sending anything. */
  readonly onReplyEmpty: (participantId: string) => void
  /** UX_DESIGN "Actions on a response": Reply, with text — sent to the participant immediately. */
  readonly onReply: (participantId: string, message: string) => void
  /** UX_DESIGN "Actions on a response": Ask for a concrete change. */
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

/**
 * What is true about the round as a whole, in the mockup's own order and wording:
 * `1 WORKING · 4 WAITING · 0:14`. A count of zero is left out rather than said —
 * `0 PREPARING` is a fact about nothing, and the line is read at a glance.
 *
 * The elapsed count is last and is the only part that is not a count. It is absent
 * for a round with no opening stamp, which is a round read back from a
 * conversation file: those have already settled, so there is no line at all.
 */
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

/**
 * UX_DESIGN "Where the author speaks": addressing an absent specialist brings
 * it into the room's own durable cast, and the change is never something the
 * author discovers later — it is said beside the round that caused it, in the
 * mockup's own "ROOM CHANGED" placement, rather than folded into the round's
 * facts line above.
 */
function roomChangedText(names: readonly string[]): string {
  const [only] = names
  if (names.length === 1 && only !== undefined) return `${only} was addressed and is now in the room.`
  return `${names.join(', ')} were addressed and are now in the room.`
}

/**
 * UX_DESIGN "Actions on a response": a round asking for a concrete change
 * carries no author message (CONTEXT "Round"), so the foot of the
 * conversation names what it is answering in its place — never the
 * deterministic instruction itself, which SPEC "The round" keeps unshown.
 */
function askedText(name: string): string {
  return `${name} was asked for a concrete change.`
}

/**
 * UX_DESIGN "An operation in flight": the mockup's own placement, beside the
 * round's own facts line rather than at the composer — it is this round being
 * stopped, not the surface as a whole.
 */
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
      {/*
       * UX_DESIGN "Degraded and absent states": a round where nothing came back is
       * still a round, and the author is told so in a sentence rather than left
       * with a message followed by five lines of failure and no account of them.
       * Each participant keeps its own failure above this — what failed is a fact
       * about each call, and that the round has nothing to show is a fact about
       * the round.
       */}
      {everyCallFailed(round) && <p className={styles.nothing}>{NOTHING_CAME_BACK}</p>}
    </div>
  )
}

/**
 * UX_DESIGN "The conversation": the second permanent surface, adjacent to
 * the manuscript.
 */
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

  // SPEC "The room"/CODING_STANDARDS "The addressing parser... stay this
  // repository's own": the same prefix rule the room reads a sigil by, offering
  // rather than deciding — the room's own reading of the words the author sent
  // is the only thing that ever addresses anyone.
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
  // SPEC "Operation state": one operation at a time, whichever kind — the
  // client disables the controls that would start a second one rather than
  // relying on the room's own refusal, which exists for the case this misses.
  const roomBusy = conversation.busy || apply.applying !== undefined

  function askAboutChange(): void {
    if (roomBusy) return
    conversation.sendMessage(REVIEW_CHANGE_MESSAGE)
  }

  /** UX_DESIGN "Actions on a response": Reply, empty — addresses that participant in the main input and focuses it, leaving the author composing. */
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
      {/*
       * The mockup puts this at the composer, and that is the point of it: an
       * unreachable room is something the author needs to know where they are
       * about to write to it, not on a settings screen they have no reason to
       * open. It says what is still true — the manuscript is theirs — because a
       * studio whose room is down is still a place to write.
       */}
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
          {/*
           * Not disabled while the round is in flight. UX_DESIGN "A round in flight":
           * nothing about a round in flight is a reason to stop typing, and taking the
           * field away is exactly that. Sending is what waits — the button says so,
           * and `submit` refuses either way.
           *
           * SPEC: "@ariakit/react"... "the combobox that offers handles as the
           * author types one — the completion surface only". `value` carries the
           * whole message; the store's own `inputValue` is only ever the live
           * `@token`, kept separate so the room still reads the author's own text
           * and never this combobox's idea of what was typed.
           */}
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
                  // The caret leaving the token is the token closing, the same as
                  // typing a space would: nothing left to complete.
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
