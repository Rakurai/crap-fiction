import { useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { Alert, Box, Button, CircularProgress, IconButton, List, ListItem, ListItemButton, ListItemText, Stack, Toolbar, Typography } from '@mui/material'
import { iconButtonClasses } from '@mui/material/IconButton'
import type { Theme } from '@mui/material/styles'
import type { ConversationSummary } from '../../shared/conversationEntries.js'
import type { SurfaceId } from '../../shared/surfaces.js'
import { useConversationPane, useConversationPaneState } from '../pieceSession/PieceSessionProvider.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { useDeleteConversation, usePieceDetail } from '../servedFacts/resources.js'

export type ConversationsOverlayProps = Readonly<{
  pieceId: string
  surface: SurfaceId
  onDismiss: () => void
}>

export function ConversationsOverlay({ pieceId, surface, onDismiss }: ConversationsOverlayProps) {
  const detailRead = readState(usePieceDetail(pieceId))
  const detail = presentValue(detailRead)
  const conversations = detail?.surfaces[surface].conversations ?? null

  const pane = useConversationPane(surface)
  const paneState = useConversationPaneState(surface)
  const deleteConversation = useDeleteConversation(pieceId, surface)
  const [armedId, setArmedId] = useState<string | null>(null)

  function select(id: string): void {
    pane?.selectConversation(id)
    onDismiss()
  }

  function startNew(): void {
    pane?.selectConversation(null)
    onDismiss()
  }

  function confirmDelete(id: string): void {
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (paneState.conversationId === id) pane?.selectConversation(null)
        setArmedId(null)
      },
    })
  }

  return (
    <>
      <Toolbar sx={{ gap: 1 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Conversations
        </Typography>
        <IconButton aria-label="Start a new conversation" onClick={startNew} disabled={paneState.conversationId === null}>
          <AddIcon />
        </IconButton>
      </Toolbar>

      {deleteConversation.isError && <Alert severity="error" sx={{ m: 2 }}>{deleteConversation.error.message}</Alert>}

      {conversations === null ? (
        detailRead.status === 'failed' ? (
          <Alert severity="error" sx={{ m: 2 }}>{detailRead.failure.message}</Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )
      ) : conversations.length === 0 ? (
        <Typography sx={{ p: 2 }} color="text.secondary">
          No conversations yet.
        </Typography>
      ) : (
        <List disablePadding>
          {conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              current={paneState.conversationId === conversation.id}
              armed={armedId === conversation.id}
              deleting={deleteConversation.isPending && deleteConversation.variables === conversation.id}
              onSelect={() => select(conversation.id)}
              onArm={() => setArmedId(conversation.id)}
              onCancelArm={() => setArmedId(null)}
              onConfirmDelete={() => confirmDelete(conversation.id)}
            />
          ))}
        </List>
      )}
    </>
  )
}

type ConversationRowProps = Readonly<{
  conversation: ConversationSummary
  current: boolean
  armed: boolean
  deleting: boolean
  onSelect: () => void
  onArm: () => void
  onCancelArm: () => void
  onConfirmDelete: () => void
}>

function revealedAtTheRow(theme: Theme) {
  return {
    [`& .${iconButtonClasses.root}`]: { opacity: 0, transition: theme.transitions.create('opacity') },
    [`&:hover .${iconButtonClasses.root}, &:focus-within .${iconButtonClasses.root}`]: { opacity: 1 },
  }
}

function RowTime({ conversation }: Readonly<{ conversation: ConversationSummary }>) {
  const when = new Date(conversation.lastActivity).toLocaleString()
  if (conversation.opening !== undefined) return <>{when}</>
  return (
    <>
      <Typography variant="machine" component="span">
        asked for a concrete change
      </Typography>
      {` · ${when}`}
    </>
  )
}

function ConversationRow({ conversation, current, armed, deleting, onSelect, onArm, onCancelArm, onConfirmDelete }: ConversationRowProps) {
  return (
    <ListItem
      disablePadding
      sx={revealedAtTheRow}
      secondaryAction={
        armed ? (
          <Stack direction="row" spacing={0.5} sx={{ pr: 1 }}>
            <Button size="small" variant="destructive" onClick={onConfirmDelete} disabled={deleting}>
              Delete
            </Button>
            <Button size="small" variant="quiet" onClick={onCancelArm}>
              Cancel
            </Button>
          </Stack>
        ) : (
          <IconButton aria-label="Delete conversation" size="small" onClick={onArm}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )
      }
    >
      <ListItemButton onClick={onSelect} selected={current} sx={{ pr: armed ? 22 : 6 }}>
        <ListItemText primary={conversation.opening} slotProps={{ primary: { noWrap: true } }} secondary={<RowTime conversation={conversation} />} />
      </ListItemButton>
    </ListItem>
  )
}
