import { useCallback } from 'react'
import { Alert, Box, Stack, Typography } from '@mui/material'
import type { SurfaceId } from '../../shared/surfaces.js'
import { useScopeActivity } from '../eventStream/RoomStreamProvider.js'
import { useConversationPane, useConversationPaneState, useDocumentSnapshot } from '../pieceSession/PieceSessionProvider.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { useAbandonAction, useApplyRecommendation, useConversation, useDispatch } from '../servedFacts/resources.js'
import { useParticipantIdentities } from './identity.js'
import { DispatchActivity } from './ParticipantActivity.js'
import { TranscriptEntry, type ResponseActions } from './TranscriptEntry.js'

export type TranscriptProps = Readonly<{ pieceId: string; surface: SurfaceId }>

export function Transcript({ pieceId, surface }: TranscriptProps) {
  const identities = useParticipantIdentities(pieceId, surface)
  const pane = useConversationPane(surface)
  const paneState = useConversationPaneState(surface)
  const conversationId = paneState.conversationId
  const conversationRead = readState(useConversation(pieceId, surface, conversationId))
  const conversation = presentValue(conversationRead)
  const scopeActivity = useScopeActivity(surface)
  const documents = useDocumentSnapshot()

  const dispatchMutation = useDispatch(pieceId, surface, conversationId ?? '')
  const applyMutation = useApplyRecommendation(pieceId, surface, conversationId ?? '')
  const abandonMutation = useAbandonAction(pieceId, surface, conversationId ?? '')

  const toggleDisclosure = useCallback(
    (id: string) => {
      if (pane === null) return
      const next = new Set(pane.getState().disclosures)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      pane.setDisclosures(next)
    },
    [pane],
  )

  const actions: ResponseActions = {
    focusComposerFor: (identity) => pane?.setComposerText(identity === null ? '' : `@${identity.handle} `),
    reply: (identity, text) => dispatchMutation.mutate({ target: identity.id, message: text, documents }),
    askForConcreteChange: (response, clarification) =>
      dispatchMutation.mutate(
        clarification === undefined ? { respondingTo: response.id, documents } : { respondingTo: response.id, clarification, documents },
      ),
    apply: (response, constraint) =>
      applyMutation.mutate(
        constraint === undefined ? { responseId: response.id, documents } : { responseId: response.id, constraint, documents },
      ),
    abandon: (actionId) => abandonMutation.mutate(actionId),
  }

  const applyingAction = scopeActivity.status === 'busy' && scopeActivity.action.kind === 'apply' ? scopeActivity.action : null

  if (conversationId === null) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="machine">Nothing has been said here yet.</Typography>
      </Box>
    )
  }

  if (conversationRead.status === 'notArrived') {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="machine">Loading the conversation…</Typography>
      </Box>
    )
  }

  if (conversation === null) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">The conversation could not be read.</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', width: '100%', overflowY: 'auto', p: 2 }}>
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
            busy={scopeActivity.status === 'busy'}
            applyingResponseId={applyingAction?.sourceEntryId ?? null}
            applyingActionId={applyingAction?.actionId ?? null}
          />
        ))}
        {scopeActivity.status === 'busy' && scopeActivity.action.kind === 'dispatch' && (
          <DispatchActivity action={scopeActivity.action} entries={conversation.entries} identities={identities} />
        )}
      </Stack>
    </Box>
  )
}
