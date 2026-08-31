import { useCallback } from 'react'
import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import type { SurfaceId } from '../../shared/surfaces.js'
import { useRoomHold, useScopeActivity, useScopeFailures, useScopeFinish } from '../eventStream/RoomStreamProvider.js'
import type { ConversationPane } from '../pieceSession/conversationPane.js'
import { useConversationPane, useConversationPaneState, useDocumentSnapshot, usePieceSession } from '../pieceSession/PieceSessionProvider.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { useConversation, useDispatch } from '../servedFacts/resources.js'
import { useApplyOrchestration } from './applyOrchestration.js'
import { useParticipantIdentities } from './identity.js'
import { ApplyStatement, DispatchActivity, RoomTrouble } from './ParticipantActivity.js'
import { TranscriptEntry, type ResponseActions } from './TranscriptEntry.js'

export type TranscriptProps = Readonly<{ pieceId: string; surface: SurfaceId }>

export function Transcript({ pieceId, surface }: TranscriptProps) {
  const pane = useConversationPane(surface)
  const conversationId = useConversationPaneState(surface).conversationId

  if (pane === null || conversationId === null) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
        <Typography variant="machine">Nothing has been said here yet.</Typography>
      </Box>
    )
  }

  return <SelectedConversation pieceId={pieceId} surface={surface} conversationId={conversationId} pane={pane} />
}

type SelectedConversationProps = Readonly<{ pieceId: string; surface: SurfaceId; conversationId: string; pane: ConversationPane }>

function SelectedConversation({ pieceId, surface, conversationId, pane }: SelectedConversationProps) {
  const identities = useParticipantIdentities(pieceId, surface)
  const paneState = useConversationPaneState(surface)
  const conversationQuery = useConversation(pieceId, surface, conversationId)
  const conversationRead = readState(conversationQuery)
  const conversation = presentValue(conversationRead)
  const scopeActivity = useScopeActivity(surface)
  const held = useRoomHold(surface)
  const scopeFailures = useScopeFailures(surface)
  const scopeFinish = useScopeFinish(surface)
  const documents = useDocumentSnapshot()
  const session = usePieceSession()

  const dispatchMutation = useDispatch(pieceId, surface, conversationId)
  const applyOrchestration = useApplyOrchestration(pieceId, surface, conversationId, session?.surfaces[surface].document ?? null)

  const toggleDisclosure = useCallback(
    (id: string) => {
      const next = new Set(pane.getState().disclosures)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      pane.setDisclosures(next)
    },
    [pane],
  )

  const actions: ResponseActions = {
    focusComposerFor: (identity) => pane.setComposerText(identity === null ? '' : `@${identity.handle} `),
    reply: (identity, text) => dispatchMutation.mutate({ target: identity.id, message: text, documents }),
    askForConcreteChange: (response, clarification) =>
      dispatchMutation.mutate(
        clarification === undefined ? { respondingTo: response.id, documents } : { respondingTo: response.id, clarification, documents },
      ),
    apply: (response, constraint) => applyOrchestration.apply(response, constraint, documents),
    abandon: (actionId) => applyOrchestration.abandon(actionId),
  }

  const applyingAction = scopeActivity.status === 'busy' && scopeActivity.action.kind === 'apply' ? scopeActivity.action : null

  if (conversationRead.status === 'notArrived') {
    return (
      <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
        <Typography variant="machine">Loading the conversation…</Typography>
      </Box>
    )
  }

  if (conversation === null) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button variant="quiet" size="small" disabled={conversationQuery.isFetching} onClick={() => void conversationQuery.refetch()}>
              Read it again
            </Button>
          }
        >
          The conversation could not be read.
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, width: '100%', overflowY: 'auto', p: 2 }}>
      <Stack spacing={2}>
        {conversationRead.status === 'refreshFailed' && (
          <Typography variant="machine">the conversation could not be refreshed — showing what was last read</Typography>
        )}
        {conversation.entries.map((entry) => (
          <TranscriptEntry
            key={entry.id}
            entry={entry}
            entries={conversation.entries}
            identities={identities}
            actions={actions}
            disclosed={paneState.disclosures}
            onToggleDisclosure={toggleDisclosure}
            withheld={held}
            applyingResponseId={applyingAction?.sourceEntryId ?? null}
            applyingActionId={applyingAction?.actionId ?? null}
            holdReason={applyOrchestration.statement}
          />
        ))}
        {scopeActivity.status === 'busy' && scopeActivity.action.kind === 'dispatch' && (
          <DispatchActivity action={scopeActivity.action} entries={conversation.entries} identities={identities} />
        )}
        {applyingAction === null && <ApplyStatement statement={applyOrchestration.statement} />}
        <RoomTrouble failures={scopeFailures} finished={scopeFinish} requestFailure={dispatchMutation.error?.message ?? null} />
      </Stack>
    </Box>
  )
}
