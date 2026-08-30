import { useLayoutEffect, useRef, useState } from 'react'
import { Box, Button, Collapse, Stack, TextField, Typography } from '@mui/material'
import type { AppliedChangeContent } from '../../shared/appliedChange.js'
import type { ParticipantFailureEntry, ParticipantResponseEntry } from '../../shared/conversationEntries.js'
import type { ApplicationEntryView, ConversationEntryView } from '../../shared/conversationEntryViews.js'
import type { FailureReason } from '../../shared/modelResult.js'
import { ParticipantMark, ParticipantNameHandle } from './ParticipantBadge.js'
import type { ParticipantIdentity } from './identity.js'
import { TranscriptRow } from './TranscriptRow.js'

const FAILURE_TEXT: Readonly<Record<FailureReason, string>> = {
  unconfigured: 'no model is assigned to this call',
  unreachable: 'the model could not be reached',
  timeout: 'the model did not answer in time',
  malformed: "the model's answer could not be read",
  nonconforming: "the model's answer did not fit what was asked",
  internal: 'something went wrong on this end',
}

function formatTimestamp(atMs: number): string {
  return new Date(atMs).toLocaleString()
}

export type ResponseActions = Readonly<{
  focusComposerFor: (identity: ParticipantIdentity | null) => void
  reply: (identity: ParticipantIdentity, text: string) => void
  askForConcreteChange: (response: ParticipantResponseEntry, clarification: string | undefined) => void
  apply: (response: ParticipantResponseEntry, constraint: string | undefined) => void
  abandon: (actionId: string) => void
}>

const CLAMP_SX = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
} as const

function ClampedClaim({ text, disclosed, onToggle }: Readonly<{ text: string; disclosed: boolean; onToggle: () => void }>) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => setOverflowing(false), [text])

  useLayoutEffect(() => {
    if (disclosed) return
    const el = ref.current
    if (el !== null && el.scrollHeight > el.clientHeight + 1) setOverflowing(true)
  }, [text, disclosed])

  return (
    <Box>
      <Typography ref={ref} variant="room" sx={disclosed ? undefined : CLAMP_SX}>
        {text}
      </Typography>
      {(overflowing || disclosed) && (
        <Button variant="quiet" size="small" onClick={onToggle}>
          {disclosed ? 'Show less' : 'Show more'}
        </Button>
      )}
    </Box>
  )
}

function ResponseNote({ text }: Readonly<{ text: string }>) {
  return (
    <Typography variant="room" sx={{ opacity: 0.72 }}>
      {text}
    </Typography>
  )
}

function AppliedChangeDisclosure({
  content,
  disclosed,
  onToggle,
}: Readonly<{ content: AppliedChangeContent; disclosed: boolean; onToggle: () => void }>) {
  const label = content.kind === 'rewrittenWhole' ? 'rewritten whole' : 'applied'

  return (
    <Box>
      <Button variant="quiet" size="small" onClick={onToggle}>
        {label}
      </Button>
      <Collapse in={disclosed}>
        {content.kind === 'passages' && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            {content.passages.map((passage, index) => (
              <Typography key={index} variant="room" component="p" sx={{ m: 0 }}>
                {passage.leading}
                {passage.before !== '' && (
                  <Box component="span" sx={{ textDecoration: 'line-through', opacity: 0.6 }}>
                    {passage.before}
                  </Box>
                )}
                {passage.after !== '' && <Box component="span" sx={{ fontWeight: 600 }}>{passage.after}</Box>}
                {passage.trailing}
              </Typography>
            ))}
          </Stack>
        )}
      </Collapse>
    </Box>
  )
}

export function AuthorMessageLine({
  text,
  atMs,
  brought,
  castSize,
  identities,
}: Readonly<{
  text: string
  atMs: number | undefined
  brought: readonly string[]
  castSize: number | undefined
  identities: ReadonlyMap<string, ParticipantIdentity>
}>) {
  return (
    <TranscriptRow gutter={null}>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography variant="author" sx={{ flexGrow: 1 }}>
            {text}
          </Typography>
          {atMs !== undefined && <Typography variant="machine">{formatTimestamp(atMs)}</Typography>}
        </Stack>
        {brought.length > 0 && (
          <Typography variant="machine">
            brought {brought.map((id) => identities.get(id)?.displayName ?? id).join(', ')} into the room — {castSize} specialist
            {castSize === 1 ? '' : 's'} in the room now
          </Typography>
        )}
      </Stack>
    </TranscriptRow>
  )
}

export function ConcreteChangeRequestLine({
  target,
  clarification,
  atMs,
  identities,
}: Readonly<{ target: string; clarification: string | undefined; atMs: number | undefined; identities: ReadonlyMap<string, ParticipantIdentity> }>) {
  const targetIdentity = identities.get(target)

  return (
    <TranscriptRow gutter={null}>
      <Stack spacing={0.5}>
        {clarification !== undefined && <Typography variant="author">{clarification}</Typography>}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography variant="machine">asked {targetIdentity?.displayName ?? target} to get concrete</Typography>
          {atMs !== undefined && <Typography variant="machine">{formatTimestamp(atMs)}</Typography>}
        </Stack>
      </Stack>
    </TranscriptRow>
  )
}

export function NoCommentLine({ identity }: Readonly<{ identity: ParticipantIdentity }>) {
  return (
    <TranscriptRow gutter={<ParticipantMark identity={identity} />}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
        <ParticipantNameHandle identity={identity} />
        <Typography variant="machine">had nothing to add</Typography>
      </Stack>
    </TranscriptRow>
  )
}

export function FailureLine({ entry, identity }: Readonly<{ entry: ParticipantFailureEntry; identity: ParticipantIdentity }>) {
  return (
    <TranscriptRow gutter={<ParticipantMark identity={identity} />}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
        <ParticipantNameHandle identity={identity} />
        <Typography variant="machine">
          the call failed — {FAILURE_TEXT[entry.reason]}
          {entry.returned !== undefined ? `: ${entry.returned}` : ''}
        </Typography>
      </Stack>
    </TranscriptRow>
  )
}

export type ParticipantResponseCardProps = Readonly<{
  entry: ParticipantResponseEntry
  identity: ParticipantIdentity
  application: ApplicationEntryView | undefined
  actions: ResponseActions
  disclosed: ReadonlySet<string>
  onToggleDisclosure: (id: string) => void
  busy: boolean
  applyingActionId: string | null
  holdReason: string | null
}>

export function ParticipantResponseCard({
  entry,
  identity,
  application,
  actions,
  disclosed,
  onToggleDisclosure,
  busy,
  applyingActionId,
  holdReason,
}: ParticipantResponseCardProps) {
  const [text, setText] = useState('')

  return (
    <TranscriptRow gutter={<ParticipantMark identity={identity} />}>
      <Stack spacing={0.75}>
        <ParticipantNameHandle identity={identity} />
        <ClampedClaim text={entry.claim} disclosed={disclosed.has(entry.id)} onToggle={() => onToggleDisclosure(entry.id)} />
        {entry.note !== undefined && <ResponseNote text={entry.note} />}
        {application?.change !== undefined && (
          <AppliedChangeDisclosure
            content={application.change}
            disclosed={disclosed.has(application.id)}
            onToggle={() => onToggleDisclosure(application.id)}
          />
        )}
        {applyingActionId !== null ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="machine">
              {holdReason ?? `this document is being held while ${identity.displayName} applies its recommendation`}
            </Typography>
            <Button variant="quiet" size="small" onClick={() => actions.abandon(applyingActionId)}>
              Abandon
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Say more (optional)"
              disabled={busy}
              sx={{ flexGrow: 1, minWidth: 160 }}
            />
            {application === undefined && entry.outcome === 'applicableSuggestion' && (
              <Button
                variant="affirm"
                size="small"
                disabled={busy}
                onClick={() => {
                  actions.apply(entry, text.trim() === '' ? undefined : text.trim())
                  setText('')
                }}
              >
                Apply
              </Button>
            )}
            {entry.outcome === 'commentary' && (
              <Button
                variant="affirm"
                size="small"
                disabled={busy}
                onClick={() => {
                  actions.askForConcreteChange(entry, text.trim() === '' ? undefined : text.trim())
                  setText('')
                }}
              >
                Ask for a concrete change
              </Button>
            )}
            {application !== undefined && (
              <Button variant="quiet" size="small" disabled={busy} onClick={() => actions.focusComposerFor(null)}>
                Ask the room about this change
              </Button>
            )}
            <Button
              variant="affirm"
              size="small"
              disabled={busy}
              onClick={() => {
                if (text.trim() === '') {
                  actions.focusComposerFor(identity)
                  return
                }
                actions.reply(identity, text.trim())
                setText('')
              }}
            >
              Reply
            </Button>
          </Stack>
        )}
      </Stack>
    </TranscriptRow>
  )
}

export type TranscriptEntryProps = Readonly<{
  entry: ConversationEntryView
  entries: readonly ConversationEntryView[]
  identities: ReadonlyMap<string, ParticipantIdentity>
  actions: ResponseActions
  disclosed: ReadonlySet<string>
  onToggleDisclosure: (id: string) => void
  busy: boolean
  applyingResponseId: string | null
  applyingActionId: string | null
  holdReason: string | null
}>

export function TranscriptEntry({
  entry,
  entries,
  identities,
  actions,
  disclosed,
  onToggleDisclosure,
  busy,
  applyingResponseId,
  applyingActionId,
  holdReason,
}: TranscriptEntryProps) {
  switch (entry.kind) {
    case 'authorMessage':
      return <AuthorMessageLine text={entry.text} atMs={entry.atMs} brought={entry.brought} castSize={entry.castSize} identities={identities} />
    case 'concreteChangeRequest':
      return (
        <ConcreteChangeRequestLine target={entry.target} clarification={entry.clarification} atMs={entry.atMs} identities={identities} />
      )
    case 'participantResponse': {
      const identity = identities.get(entry.participantId)
      if (identity === undefined) return null
      const application = entries.find(
        (candidate): candidate is ApplicationEntryView => candidate.kind === 'application' && candidate.responseId === entry.id,
      )
      return (
        <ParticipantResponseCard
          entry={entry}
          identity={identity}
          application={application}
          actions={actions}
          disclosed={disclosed}
          onToggleDisclosure={onToggleDisclosure}
          busy={busy}
          applyingActionId={applyingResponseId === entry.id ? applyingActionId : null}
          holdReason={holdReason}
        />
      )
    }
    case 'participantNoComment': {
      const identity = identities.get(entry.participantId)
      return identity === undefined ? null : <NoCommentLine identity={identity} />
    }
    case 'participantFailure': {
      const identity = identities.get(entry.participantId)
      return identity === undefined ? null : <FailureLine entry={entry} identity={identity} />
    }
    case 'application':
      return null
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}
