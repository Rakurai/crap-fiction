import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Paper, Stack, TextField, Typography } from '@mui/material'
import type { SurfaceId } from '../../shared/surfaces.js'
import { config } from '../config.js'
import { useRoomConnectionStatus, useScopeActivity } from '../eventStream/RoomStreamProvider.js'
import type { ConnectionStatus } from '../eventStream/roomProjection.js'
import { useConversationPane, useConversationPaneState, useDocumentSnapshot } from '../pieceSession/PieceSessionProvider.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { dispatchTo, mintConversation, useAbandonAction, usePieceDetail, type DispatchResult } from '../servedFacts/resources.js'
import type { RequestFailure } from '../servedFacts/transport.js'
import { useParticipantIdentities, type ParticipantIdentity } from '../transcript/identity.js'
import { HandlePicker } from './HandlePicker.js'
import { detectMentionQuery, insertMention, matchingHandles, type MentionQuery } from './mentionQuery.js'

export type ComposerProps = Readonly<{ pieceId: string; surface: SurfaceId }>

function unrecoveredConnection(connection: ConnectionStatus): string | null {
  switch (connection.status) {
    case 'absent':
      return null
    case 'retrying':
      return null
    case 'open':
      return null
    case 'failed':
      return "the room's connection could not be recovered — reload to try again"
    default: {
      const exhaustive: never = connection
      return exhaustive
    }
  }
}

export function Composer({ pieceId, surface }: ComposerProps) {
  const identities = useParticipantIdentities(pieceId, surface)
  const candidates = useMemo(() => [...identities.values()], [identities])
  const detail = presentValue(readState(usePieceDetail(pieceId)))

  const pane = useConversationPane(surface)
  const paneState = useConversationPaneState(surface)
  const documents = useDocumentSnapshot()
  const activity = useScopeActivity(surface)
  const connection = useRoomConnectionStatus()

  const busyAction = activity.status === 'busy' ? activity.action : null
  const busyDispatch = busyAction !== null && busyAction.kind === 'dispatch' ? busyAction : null
  const unrecovered = unrecoveredConnection(connection)

  const abandonMutation = useAbandonAction(pieceId, surface)

  const sendMutation = useMutation<DispatchResult, RequestFailure, string>({
    mutationFn: async (text) => {
      const conversationId = pane?.getState().conversationId ?? null
      const resolvedId = conversationId ?? (await mintConversation(pieceId, surface)).id
      if (conversationId === null) pane?.selectConversation(resolvedId)
      return dispatchTo(pieceId, surface, resolvedId, { message: text, documents })
    },
    onError: (_failure, sent) => {
      if (pane?.getState().composerText === '') pane.setComposerText(sent)
    },
  })

  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingCaretRef = useRef<number | null>(null)
  const [query, setQuery] = useState<MentionQuery | undefined>(undefined)
  const [activeIndex, setActiveIndex] = useState(0)

  const matches = useMemo(
    () => (query === undefined ? [] : matchingHandles(query.token, candidates, config.mentions.maxMatches)),
    [query, candidates],
  )

  useEffect(() => {
    const pos = pendingCaretRef.current
    if (pos === null) return
    pendingCaretRef.current = null
    fieldRef.current?.setSelectionRange(pos, pos)
  }, [paneState.composerText])

  const disabled = activity.status !== 'idle' || unrecovered !== null || sendMutation.isPending
  const text = paneState.composerText
  const canSend = !disabled && text.trim() !== ''

  function closePicker() {
    setQuery(undefined)
    setActiveIndex(0)
  }

  function commitMention(identity: ParticipantIdentity) {
    if (pane === null || query === undefined) return
    const insertion = insertMention(text, query, identity.handle)
    pendingCaretRef.current = insertion.caret
    pane.setComposerText(insertion.text)
    closePicker()
    fieldRef.current?.focus()
  }

  function handleChange(value: string, caret: number) {
    if (pane === null) return
    pane.setComposerText(value)
    setQuery(detectMentionQuery(value, caret))
    setActiveIndex(0)
  }

  function send(message: string) {
    if (pane === null) return
    pane.setComposerText('')
    closePicker()
    sendMutation.mutate(message)
  }

  function handleSend() {
    if (!canSend) return
    send(text.trim())
  }

  function handleAskMe() {
    if (disabled || detail === null) return
    send(`@${detail.interviewer.handle} ${detail.interviewer.invocation}`)
  }

  function handleStop() {
    if (busyDispatch === null) return
    abandonMutation.mutate({ conversationId: busyDispatch.conversationId, actionId: busyDispatch.actionId })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (query !== undefined && matches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % matches.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + matches.length) % matches.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const identity = matches[activeIndex]
        if (identity !== undefined) commitMention(identity)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        closePicker()
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  if (pane === null) return null

  return (
    <Paper elevation={0} square sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
      {unrecovered !== null && (
        <Typography variant="machine" sx={{ display: 'block', mb: 1 }}>
          {unrecovered}
        </Typography>
      )}
      {sendMutation.error !== null && (
        <Typography variant="machine" sx={{ display: 'block', mb: 1 }}>
          {sendMutation.error.message}
        </Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
        <TextField
          inputRef={fieldRef}
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          size="small"
          placeholder="Message the room"
          value={text}
          onChange={(event) => handleChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
          onKeyDown={handleKeyDown}
          onBlur={closePicker}
        />
        <Stack spacing={0.5}>
          <Button variant="quiet" size="small" disabled={disabled} onClick={handleAskMe}>
            Ask me
          </Button>
          {busyDispatch !== null ? (
            <Button variant="destructive" size="small" onClick={handleStop}>
              Stop
            </Button>
          ) : (
            <Button variant="affirm" size="small" disabled={!canSend} onClick={handleSend}>
              Send
            </Button>
          )}
        </Stack>
      </Stack>
      <HandlePicker anchorEl={fieldRef.current} matches={matches} activeIndex={activeIndex} onPick={commitMention} />
    </Paper>
  )
}
