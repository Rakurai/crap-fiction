import * as Ariakit from '@ariakit/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppliedChangeContent, ChangedPassage } from '../shared/appliedChange.js'
import { conversationName } from './conversationNaming.js'
import type { ApplicationEntryView, ConversationEntryView } from '../shared/conversationEntryViews.js'
import type { Clock } from '../shared/clock.js'
import type { DispatchActivitySnapshot } from '../shared/conversationEvents.js'
import type { InterviewerView } from '../shared/pieceViews.js'
import type { DocumentSnapshot, SurfaceId } from '../shared/surfaces.js'
import { countWords } from '../shared/storyLength.js'
import type { AutosaveState } from './autosave.js'
import { isChangeDisclosed, setChangeDisclosed } from './appliedChangeDisclosure.js'
import { config } from './config.js'
import { elapsed, facts, machineWords, messageWhen, passageCount, wordCount } from './facts.js'
import styles from './Conversation.module.css'
import { Mark } from './Mark.js'
import { isParticipantOutcome } from './entryProjection.js'
import { completeMention, mentionQuery, type MentionQuery } from './mentionTrigger.js'
import { useApply, type ApplySettlement, type ApplyingResponse } from './useApply.js'
import { useNow } from './useNow.js'
import type { ApplyingHold } from './useConversationSession.js'
import type { ParticipantIdentity } from './useRoster.js'
import { type RoomAdapters, useConversation } from './useConversation.js'

const REVIEW_CHANGE_MESSAGE = 'Take a look at the change I just made and tell me what you think.'

export type HandleEntry = Readonly<{ handle: string; displayName: string }>

type ConversationProps = {
  readonly pieceId: string
  readonly surface: SurfaceId
  readonly currentConversationId: string | null
  readonly documents: DocumentSnapshot
  readonly flushDocument: () => Promise<AutosaveState>
  readonly room: RoomAdapters
  readonly identify: (participantId: string) => ParticipantIdentity
  readonly handles: readonly HandleEntry[]
  readonly interviewer: InterviewerView
  readonly runtime: { readonly reachable: boolean } | undefined
  readonly clock: Clock
  readonly onApplied: (text: string) => Promise<AutosaveState>
  readonly onApplyingChange: (applying: ApplyingHold | undefined) => void
  readonly onConversationIdChange: (conversationId: string) => void
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
  readonly outcome: 'commentary' | 'applicableSuggestion' | 'failed' | 'applied'
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
      <button type="button" className={styles.actionButton} disabled={disabled} onClick={reply}>
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

function changeSummary(passages: readonly ChangedPassage[]): string {
  const words = passages.reduce((sum, passage) => sum + countWords(passage.after), 0)
  return passages.length > 1
    ? facts(machineWords('applied'), wordCount(words), passageCount(passages.length))
    : facts(machineWords('applied'), wordCount(words))
}

function AppliedChangeView({
  id,
  content,
  freshlyStreamed,
  askDisabled,
  onAskAboutChange,
}: {
  readonly id: string
  readonly content: AppliedChangeContent | undefined
  readonly freshlyStreamed: boolean
  readonly askDisabled: boolean
  readonly onAskAboutChange: () => void
}) {
  const [open, setOpen] = useState(() => freshlyStreamed || isChangeDisclosed(id))

  useEffect(() => {
    setChangeDisclosed(id, open)
  }, [id, open])

  return (
    <div className={styles.change}>
      {content === undefined ? (
        <span className={styles.changeFacts}>{facts(machineWords('applied'), machineWords('change file missing'))}</span>
      ) : content.kind === 'rewrittenWhole' ? (
        <span className={styles.changeFacts}>{facts(machineWords('applied'), machineWords('rewritten whole'))}</span>
      ) : (
        <>
          <button type="button" className={styles.changeToggle} aria-expanded={open} onClick={() => setOpen((was) => !was)}>
            {changeSummary(content.passages)}
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

function roomChangedText(names: readonly string[], castSize: number | undefined): string {
  const [only] = names
  const brought =
    names.length === 1 && only !== undefined
      ? `${only} was addressed and is now in the room.`
      : `${names.join(', ')} were addressed and are now in the room.`
  if (castSize === undefined) return brought
  return `${brought} The room holds ${castSize} specialist${castSize === 1 ? '' : 's'}.`
}

function RoomChanged({ names, castSize }: { readonly names: readonly string[]; readonly castSize: number | undefined }) {
  return (
    <div className={styles.roomChanged}>
      <span className={styles.roomChangedFacts}>ROOM CHANGED</span>
      <span className={styles.roomChangedWords}>{roomChangedText(names, castSize)}</span>
    </div>
  )
}

function askedText(name: string): string {
  return `${name} was asked for a concrete change.`
}

function participantNameFor(
  entries: readonly ConversationEntryView[],
  responseId: string,
  identify: (id: string) => ParticipantIdentity,
): string {
  const entry = entries.find((candidate) => candidate.id === responseId)
  return identify(entry?.kind === 'participantResponse' ? entry.participantId : responseId).displayName
}

const EMPTY_APPLICATIONS: readonly ApplicationEntryView[] = []

type EntryActions = Readonly<{
  identify: (id: string) => ParticipantIdentity
  clock: Clock
  applying: ApplyingResponse | undefined
  applyDisabled: boolean
  applicationsFor: (responseId: string) => readonly ApplicationEntryView[]
  freshApplicationIds: ReadonlySet<string>
  settlement: ApplySettlement | undefined
  onApply: (responseId: string, constraint: string | undefined) => void
  onAskAboutChange: () => void
  onReplyEmpty: (participantId: string) => void
  onReply: (participantId: string, message: string) => void
  onAsk: (responseId: string, clarification: string | undefined) => void
}>

function IdentityLine({ identity, status }: { readonly identity: ParticipantIdentity; readonly status?: string | undefined }) {
  return (
    <div className={styles.identity}>
      <Mark mark={identity.mark} ordinal={identity.ordinal} />
      {identity.handle !== undefined && <span className={styles.handle}>@{identity.handle}</span>}
      <span className={styles.name}>{identity.displayName}</span>
      {status !== undefined && (
        <>
          <span className={styles.identitySpacer} />
          <span className={styles.identityStatus}>{status}</span>
        </>
      )}
    </div>
  )
}

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
    identify,
    clock,
    applying,
    applyDisabled,
    applicationsFor,
    freshApplicationIds,
    settlement,
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
          {entry.atMs !== undefined && <span className={styles.messageWhen}>{messageWhen(entry.atMs, clock)}</span>}
          {entry.brought.length > 0 && (
            <RoomChanged names={entry.brought.map((participantId) => identify(participantId).displayName)} castSize={entry.castSize} />
          )}
        </>
      )
    case 'concreteChangeRequest':
      return (
        <>
          <div className={styles.asked}>
            <span className={styles.askedFacts}>{machineWords('asked')}</span>
            <span className={styles.askedWords}>{askedText(identify(entry.target).displayName)}</span>
          </div>
          {entry.clarification !== undefined && <p className={styles.message}>{entry.clarification}</p>}
          {entry.clarification !== undefined && entry.atMs !== undefined && (
            <span className={styles.messageWhen}>{messageWhen(entry.atMs, clock)}</span>
          )}
        </>
      )
    case 'participantNoComment':
      return (
        <div className={styles.participant}>
          <IdentityLine identity={identify(entry.participantId)} status={machineWords('nothing to add')} />
        </div>
      )
    case 'participantFailure':
      return (
        <div className={styles.participant}>
          <IdentityLine identity={identify(entry.participantId)} />
          <p className={styles.failed}>did not answer — {machineWords(entry.reason)}</p>
          {entry.returned !== undefined && <p className={styles.returned}>{entry.returned}</p>}
          <ResponseActions
            responseId={entry.id}
            participantId={entry.participantId}
            participantName={identify(entry.participantId).displayName}
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
      const applied = applications.length > 0
      const responseSettlement = applied ? undefined : settlement?.responseId === entry.id ? settlement : undefined
      return (
        <div className={styles.participant}>
          <IdentityLine
            identity={identify(entry.participantId)}
            status={
              responseSettlement === undefined
                ? undefined
                : machineWords(responseSettlement.kind === 'failed' ? 'application failed' : 'application abandoned')
            }
          />
          <Claim text={entry.claim} />
          {entry.note !== undefined && <p className={styles.note}>{entry.note}</p>}
          {responseSettlement?.kind === 'failed' && (
            <>
              <p className={styles.failed}>the application did not settle — {machineWords(responseSettlement.reason)}</p>
              {responseSettlement.returned !== undefined && <p className={styles.returned}>{responseSettlement.returned}</p>}
            </>
          )}
          {applications.map((application) => (
            <AppliedChangeView
              key={application.id}
              id={application.id}
              content={application.change}
              freshlyStreamed={freshApplicationIds.has(application.id)}
              askDisabled={applyDisabled}
              onAskAboutChange={onAskAboutChange}
            />
          ))}
          {applyingThis ? (
            <ApplyingFlight />
          ) : (
            <ResponseActions
              responseId={entry.id}
              participantId={entry.participantId}
              participantName={identify(entry.participantId).displayName}
              outcome={applied ? 'applied' : entry.outcome}
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
  if (state === undefined) return machineWords('waiting')
  return facts(machineWords(state.state), elapsed(state.startedAt, nowMs))
}

function ParticipantFlightLine({
  participantId,
  identify,
  state,
  nowMs,
}: {
  readonly participantId: string
  readonly identify: (participantId: string) => ParticipantIdentity
  readonly state: DispatchActivitySnapshot['states'][string] | undefined
  readonly nowMs: number
}) {
  return (
    <div className={`${styles.participant} ${styles.pending}`}>
      <IdentityLine identity={identify(participantId)} status={participantStatus(state, nowMs)} />
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
  identify,
  handles,
  interviewer,
  runtime,
  clock,
  onApplied,
  onApplyingChange,
  onConversationIdChange,
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
    () => (query === undefined ? [] : handles.filter((entry) => entry.handle.startsWith(token.toLowerCase())).slice(0, config.mentions.maxMatches)),
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

  const apply = useApply(
    pieceId,
    surface,
    conversation.conversationId,
    () => documents,
    onApplied,
    room,
    conversation.abandonAction,
    conversation.resumedApplying,
  )

  useEffect(() => {
    onApplyingChange(
      apply.applying !== undefined
        ? {
            participantName: participantNameFor(conversation.projection.entries, apply.applying.responseId, identify),
            abandon: () => void abandonCurrentAction(),
          }
        : conversation.applyingInRoom
          ? { abandon: () => void abandonCurrentAction() }
          : undefined,
    )
  }, [apply.applying, conversation.applyingInRoom, conversation.projection.entries, identify, onApplyingChange])

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
  const conversationActionInFlight = activity !== undefined
  const opening = conversationName(conversation.projection.entries)

  function askAboutChange(): void {
    if (roomBusy) return
    conversation.sendMessage(REVIEW_CHANGE_MESSAGE)
  }

  function askTheInterviewer(): void {
    if (roomBusy) return
    conversation.sendMessage(`@${interviewer.handle} ${interviewer.invocation}`)
  }

  function replyEmpty(participantId: string): void {
    const participantHandle = identify(participantId).handle
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
    identify,
    clock,
    applying: apply.applying,
    applyDisabled: roomBusy,
    applicationsFor,
    freshApplicationIds: conversation.projection.freshApplicationIds,
    settlement: apply.settlement,
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
            identify={identify}
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
      >
        <label className={styles.visuallyHidden} htmlFor={`conversation-message-${surface}`}>
          Message the room
        </label>
        <div className={styles.field}>
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
                  if (event.key === 'Enter' && !event.shiftKey && !event.defaultPrevented) {
                    event.preventDefault()
                    submit()
                  }
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
