import { useState } from 'react'
import { machineWords } from './facts.js'
import styles from './Conversation.module.css'
import type { ProjectedParticipant, ProjectedRound } from './roundProjection.js'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import { type CallSiteAdapters, useCallSites } from './useCallSites.js'
import { type RoomAdapters, useConversation } from './useConversation.js'

type ConversationProps = {
  readonly pieceId: string
  readonly currentConversationId: string | null
  readonly roundInFlight: RoundSnapshot | null
  readonly draft: string
  readonly flushDraft: () => void
  readonly room: RoomAdapters
  readonly callSites: CallSiteAdapters
}

const STATE_LABEL: Record<'waiting' | 'preparing' | 'working', string> = {
  waiting: 'waiting',
  preparing: 'preparing its model',
  working: 'thinking',
}

function displayNameFor(sites: readonly { site: string; displayName: string | null }[] | undefined, participantId: string): string {
  return sites?.find((site) => site.site === participantId)?.displayName ?? participantId
}

function ParticipantLine({ participant, name }: { readonly participant: ProjectedParticipant; readonly name: string }) {
  if (participant.state !== 'settled') {
    return (
      <p className={styles.pending}>
        {name} — {STATE_LABEL[participant.state]}
      </p>
    )
  }

  const { result } = participant
  if (result === undefined || (result.kind === 'response' && result.outcome === 'noComment')) return null

  if (result.kind === 'abandoned') return null

  if (result.kind === 'failed') {
    return (
      <p className={styles.failed}>
        <span className={styles.name}>{name}</span> did not answer — {machineWords(result.reason)}
      </p>
    )
  }

  return (
    <p className={styles.response}>
      <span className={styles.name}>{name}</span> {result.claim}
      {result.note !== undefined && <span className={styles.note}> {result.note}</span>}
    </p>
  )
}

function RoundView({ round, displayName }: { readonly round: ProjectedRound; readonly displayName: (id: string) => string }) {
  return (
    <div className={styles.round}>
      {round.message !== undefined && <p className={styles.message}>{round.message}</p>}
      {round.participants.map((participant) => (
        <ParticipantLine key={participant.participantId} participant={participant} name={displayName(participant.participantId)} />
      ))}
      {round.outcome === 'abandoned' && <p className={styles.abandoned}>ABANDONED</p>}
    </div>
  )
}

/**
 * UX_DESIGN "The conversation": the second permanent surface, adjacent to
 * the manuscript. This tracer keeps to what issue #9 asks — one composer, the
 * accumulating rounds, and a round in flight staying legible — not the full
 * response-card and handle-combobox composition UX_DESIGN describes.
 */
export function Conversation({ pieceId, currentConversationId, roundInFlight, draft, flushDraft, room, callSites: callSiteAdapters }: ConversationProps) {
  const [message, setMessage] = useState('')
  const callSites = useCallSites(callSiteAdapters)
  const conversation = useConversation(pieceId, currentConversationId, roundInFlight, flushDraft, () => draft, room)

  const displayName = (id: string) => displayNameFor(callSites.status === 'ready' ? callSites.sites : undefined, id)

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
          <RoundView key={round.roundId} round={round} displayName={displayName} />
        ))}
      </div>
      {conversation.error !== undefined && (
        <p className={styles.error} role="alert">
          {conversation.error}
        </p>
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
        <input
          id="conversation-message"
          className={styles.input}
          value={message}
          disabled={conversation.busy}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="@shape does the opening earn its length"
        />
        <button type="submit" className={styles.send} disabled={conversation.busy || message.trim().length === 0}>
          {conversation.busy ? '…' : 'send'}
        </button>
      </form>
    </div>
  )
}
