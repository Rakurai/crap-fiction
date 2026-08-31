import { useLayoutEffect, useRef, useState } from 'react'
import { Box, Button, Collapse, Stack, TextField, Typography } from '@mui/material'
import type { AppliedChangeContent } from '../../shared/appliedChange.js'
import type { ParticipantFailureEntry, ParticipantResponseEntry } from '../../shared/conversationEntries.js'
import type { ApplicationEntryView, ConversationEntryView } from '../../shared/conversationEntryViews.js'
import { formatStamp } from '../stamp.js'
import { FAILURE_TEXT } from './failureText.js'
import { ParticipantMark, ParticipantNameHandle } from './ParticipantBadge.js'
import type { ParticipantIdentity } from './identity.js'
import { TranscriptRow } from './TranscriptRow.js'

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
    <Typography variant="room" sx={{ color: 'text.secondary' }}>
      {text}
    </Typography>
  )
}

function AppliedChangeDisclosure({
  content,
  disclosed,
  onToggle,
}: Readonly<{ content: AppliedChangeContent; disclosed: boolean; onToggle: () => void }>) {
  if (content.kind === 'rewrittenWhole') return <Typography variant="machine">rewritten whole</Typography>

  return (
    <Box>
      <Button variant="quiet" size="small" onClick={onToggle}>
        applied
      </Button>
      <Collapse in={disclosed}>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {content.passages.map((passage, index) => (
            <Typography key={index} variant="room" component="p" sx={{ m: 0 }}>
              {passage.leading}
              {passage.before !== '' && (
                <Box component="span" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
                  {passage.before}
                </Box>
              )}
              {passage.after !== '' && <Box component="span" sx={{ fontWeight: 600 }}>{passage.after}</Box>}
              {passage.trailing}
            </Typography>
          ))}
        </Stack>
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
          {atMs !== undefined && <Typography variant="machine">{formatStamp(atMs)}</Typography>}
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
          {atMs !== undefined && <Typography variant="machine">{formatStamp(atMs)}</Typography>}
        </Stack>
      </Stack>
    </TranscriptRow>
  )
}

function UnnamedParticipant() {
  return <Typography variant="machine">from a participant this studio can no longer name</Typography>
}

function Attribution({ identity }: Readonly<{ identity: ParticipantIdentity | null }>) {
  return identity === null ? <UnnamedParticipant /> : <ParticipantNameHandle identity={identity} />
}

function Gutter({ identity }: Readonly<{ identity: ParticipantIdentity | null }>) {
  return identity === null ? null : <ParticipantMark identity={identity} />
}

export function NoCommentLine({ identity }: Readonly<{ identity: ParticipantIdentity | null }>) {
  return (
    <TranscriptRow gutter={<Gutter identity={identity} />}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
        <Attribution identity={identity} />
        <Typography variant="machine">had nothing to add</Typography>
      </Stack>
    </TranscriptRow>
  )
}

export function FailureLine({ entry, identity }: Readonly<{ entry: ParticipantFailureEntry; identity: ParticipantIdentity | null }>) {
  return (
    <TranscriptRow gutter={<Gutter identity={identity} />}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Attribution identity={identity} />
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
  identity: ParticipantIdentity | null
  application: ApplicationEntryView | undefined
  actions: ResponseActions
  disclosed: ReadonlySet<string>
  onToggleDisclosure: (id: string) => void
  withheld: boolean
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
  withheld,
  applyingActionId,
  holdReason,
}: ParticipantResponseCardProps) {
  const [text, setText] = useState('')

  return (
    <TranscriptRow gutter={<Gutter identity={identity} />}>
      <Stack spacing={0.75}>
        <Attribution identity={identity} />
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
              {holdReason ??
                (identity === null
                  ? 'this document is being held while the recommendation is applied'
                  : `this document is being held while ${identity.displayName} applies its recommendation`)}
            </Typography>
            <Button variant="quiet" size="small" onClick={() => actions.abandon(applyingActionId)}>
              Abandon
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Say more (optional)"
              sx={{ minWidth: (theme) => theme.spacing(20), maxWidth: '100%' }}
            />
            {application === undefined && entry.outcome === 'applicableSuggestion' && (
              <Button
                variant="affirm"
                size="small"
                disabled={withheld}
                onClick={() => {
                  actions.apply(entry, text.trim() === '' ? undefined : text.trim())
                  setText('')
                }}
              >
                Apply
              </Button>
            )}
            {entry.outcome === 'commentary' && identity !== null && (
              <Button
                variant="affirm"
                size="small"
                disabled={withheld}
                onClick={() => {
                  actions.askForConcreteChange(entry, text.trim() === '' ? undefined : text.trim())
                  setText('')
                }}
              >
                Ask for a concrete change
              </Button>
            )}
            {application !== undefined && (
              <Button variant="quiet" size="small" disabled={withheld} onClick={() => actions.focusComposerFor(null)}>
                Ask the room about this change
              </Button>
            )}
            {identity !== null && (
              <Button
                variant="affirm"
                size="small"
                disabled={withheld}
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
            )}
          </Stack>
        )}
      </Stack>
    </TranscriptRow>
  )
}

export type TranscriptEntryProps = Readonly<{
  entry: ConversationEntryView
  application: ApplicationEntryView | undefined
  identities: ReadonlyMap<string, ParticipantIdentity>
  actions: ResponseActions
  disclosed: ReadonlySet<string>
  onToggleDisclosure: (id: string) => void
  withheld: boolean
  applyingResponseId: string | null
  applyingActionId: string | null
  holdReason: string | null
}>

export function TranscriptEntry({
  entry,
  application,
  identities,
  actions,
  disclosed,
  onToggleDisclosure,
  withheld,
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
    case 'participantResponse':
      return (
        <ParticipantResponseCard
          entry={entry}
          identity={identities.get(entry.participantId) ?? null}
          application={application}
          actions={actions}
          disclosed={disclosed}
          onToggleDisclosure={onToggleDisclosure}
          withheld={withheld}
          applyingActionId={applyingResponseId === entry.id ? applyingActionId : null}
          holdReason={holdReason}
        />
      )
    case 'participantNoComment':
      return <NoCommentLine identity={identities.get(entry.participantId) ?? null} />
    case 'participantFailure':
      return <FailureLine entry={entry} identity={identities.get(entry.participantId) ?? null} />
    case 'application':
      return null
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}
