import { useState, type ReactNode } from 'react'
import type { Clock } from '../shared/clock.js'
import { elapsed, facts, machineWords } from './facts.js'
import styles from './Conversation.module.css'
import { everyCallFailed, tallyRound, type ProjectedParticipant, type ProjectedRound } from './roundProjection.js'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import type { RuntimeStatus } from '../shared/runtimeStatus.js'
import { useNow } from './useNow.js'
import { type RoomAdapters, useConversation } from './useConversation.js'

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
  /**
   * Whether a model can be reached, as the screen last heard it. `undefined` is
   * not "unreachable": it is nothing heard either way, and a notice drawn from it
   * would tell the author the room is down on the strength of a request that
   * failed on this end.
   */
  readonly runtime: RuntimeStatus | undefined
  /** The clock the elapsed count is read from, so a test states the moment rather than waiting for it. */
  readonly clock: Clock
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
function ParticipantBlock({ participant, name, mark }: { readonly participant: ProjectedParticipant; readonly name: string; readonly mark: string }) {
  const says = participantSays(participant)
  if (says === null) return null

  return (
    <div className={styles.participant}>
      <div className={styles.identity}>
        <span className={styles.mark} style={{ background: mark }} aria-hidden="true" />
        <span className={styles.name}>{name}</span>
      </div>
      {says}
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
}: {
  readonly round: ProjectedRound
  readonly nowMs: number
  readonly displayName: (id: string) => string
  readonly mark: (id: string) => string
  readonly onAbandon: () => void
}) {
  return (
    <div className={styles.round}>
      {round.message !== undefined && <p className={styles.message}>{round.message}</p>}
      {round.outcome === 'inFlight' && <RoundFlight round={round} nowMs={nowMs} onAbandon={onAbandon} />}
      {round.participants.map((participant) => (
        <ParticipantBlock
          key={participant.participantId}
          participant={participant}
          name={displayName(participant.participantId)}
          mark={mark(participant.participantId)}
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
 * the manuscript. This tracer keeps to what issue #9 asks — one composer, the
 * accumulating rounds, and a round in flight staying legible — not the full
 * response-card and handle-combobox composition UX_DESIGN describes.
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
  runtime,
  clock,
}: ConversationProps) {
  const [message, setMessage] = useState('')
  const conversation = useConversation(pieceId, currentConversationId, roundInFlight, flushDraft, () => draft, room)
  const counting = conversation.projection.rounds.some((round) => round.outcome === 'inFlight')
  const nowMs = useNow(counting, clock)

  function submit() {
    const text = message.trim()
    if (text.length === 0 || conversation.busy) return
    conversation.sendMessage(text)
    setMessage('')
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.rounds}>
        {conversation.projection.rounds.map((round) => (
          <RoundView key={round.roundId} round={round} nowMs={nowMs} displayName={displayName} mark={mark} onAbandon={conversation.abandon} />
        ))}
      </div>
      {conversation.error !== undefined && (
        <p className={styles.error} role="alert">
          {conversation.error}
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
        {/*
         * Not disabled while the round is in flight. UX_DESIGN "A round in flight":
         * nothing about a round in flight is a reason to stop typing, and taking the
         * field away is exactly that. Sending is what waits — the button says so,
         * and `submit` refuses either way.
         */}
        <input
          id="conversation-message"
          className={styles.input}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="what isn’t working about the ending"
        />
        <button type="submit" className={styles.send} disabled={conversation.busy || message.trim().length === 0}>
          {conversation.busy ? '…' : 'send'}
        </button>
      </form>
    </div>
  )
}
