import { Stack, Typography } from '@mui/material'
import type { ParticipantFailureEntry, ParticipantNoCommentEntry, ParticipantResponseEntry } from '../../shared/conversationEntries.js'
import type { ConversationEntryView } from '../../shared/conversationEntryViews.js'
import { config } from '../config.js'
import type { BusyAction } from '../eventStream/roomProjection.js'
import { formatElapsed, useTick } from './elapsedTime.js'
import { ParticipantMark, ParticipantNameHandle } from './ParticipantBadge.js'
import type { ParticipantIdentity } from './identity.js'
import { TranscriptRow } from './TranscriptRow.js'

const STAGE_LABEL: Readonly<Record<'called' | 'preparing' | 'working', string>> = {
  called: 'called',
  preparing: 'having its model prepared',
  working: 'working',
}

type AnswerEntry = ParticipantResponseEntry | ParticipantNoCommentEntry | ParticipantFailureEntry

function isAnswer(entry: ConversationEntryView): entry is AnswerEntry {
  return entry.kind === 'participantResponse' || entry.kind === 'participantNoComment' || entry.kind === 'participantFailure'
}

function answeredParticipantIds(sourceEntryId: string, entries: readonly ConversationEntryView[]): ReadonlySet<string> {
  const answers = entries.filter(isAnswer).filter((entry) => entry.causeId === sourceEntryId)
  return new Set(answers.map((entry) => entry.participantId))
}

export type DispatchActivityProps = Readonly<{
  action: BusyAction
  entries: readonly ConversationEntryView[]
  identities: ReadonlyMap<string, ParticipantIdentity>
}>

export function DispatchActivity({ action, entries, identities }: DispatchActivityProps) {
  const now = useTick(config.elapsedTime.tickMs)
  const answered = answeredParticipantIds(action.sourceEntryId, entries)
  const outstanding = action.audience.filter((id) => !answered.has(id))

  if (outstanding.length === 0) return null

  return (
    <Stack spacing={1}>
      {outstanding.map((id) => {
        const identity = identities.get(id)
        if (identity === undefined) return null
        const state = action.participants[id]
        return (
          <TranscriptRow key={id} gutter={<ParticipantMark identity={identity} />}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
              <ParticipantNameHandle identity={identity} />
              <Typography variant="machine">
                {state === undefined ? 'waiting to be called' : `${STAGE_LABEL[state.state]} · ${formatElapsed(state.startedAt, now)}`}
              </Typography>
            </Stack>
          </TranscriptRow>
        )
      })}
    </Stack>
  )
}
