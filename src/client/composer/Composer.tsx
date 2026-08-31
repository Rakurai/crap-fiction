import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Paper, Stack, TextField, Typography } from '@mui/material'
import type { SurfaceId } from '../../shared/surfaces.js'
import { config } from '../config.js'
import { useRoomHold, useScopeActivity, useStreamFailure } from '../eventStream/RoomStreamProvider.js'
import type { StreamFailureReason } from '../eventStream/roomProjection.js'
import { useConversationPane, useConversationPaneState, useDocumentSnapshot } from '../pieceSession/PieceSessionProvider.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { dispatchTo, mintConversation, useAbandonAction, useModels, usePieceDetail, type DispatchResult } from '../servedFacts/resources.js'
import type { RequestFailure } from '../servedFacts/transport.js'
import { useParticipantIdentities, type ParticipantIdentity } from '../transcript/identity.js'
import { HandlePicker } from './HandlePicker.js'
import { detectMentionQuery, insertMention, matchingHandles, type MentionQuery } from './mentionQuery.js'

type ComposerProps = Readonly<{ pieceId: string; surface: SurfaceId }>

const STREAM_FAILURE_TEXT: Readonly<Record<StreamFailureReason, string>> = {
  disconnected: "the studio has stopped trying to reach the room's events — reload to see what it is doing",
  unreadable: "the room sent an event the studio could not read — reload to see what it is doing",
}

const ROOM_UNAVAILABLE_TEXT = 'the room is unavailable — nothing here can run a model until one is running on this machine'

export function Composer({ pieceId, surface }: ComposerProps) {
  const identities = useParticipantIdentities(pieceId, surface)
  const candidates = useMemo(() => [...identities.values()], [identities])
  const detail = presentValue(readState(usePieceDetail(pieceId)))

  const pane = useConversationPane(surface)
  const paneState = useConversationPaneState(surface)
  const documents = useDocumentSnapshot()
  const activity = useScopeActivity(surface)
  const held = useRoomHold(surface)
  const streamFailure = useStreamFailure()
  const runtime = presentValue(readState(useModels()))
  const roomUnavailable = runtime !== null && !runtime.reachable

  const busyAction = activity.status === 'busy' ? activity.action : null
  const busyDispatch = busyAction !== null && busyAction.kind === 'dispatch' ? busyAction : null

  const abandonMutation = useAbandonAction(pieceId, surface)

  const sendMutation = useMutation<DispatchResult, RequestFailure, string>({
    mutationFn: async (text) => {
      const conversationId = pane?.getState().conversationId ?? null
      const resolvedId = conversationId ?? (await mintConversation(pieceId, surface)).id
      return dispatchTo(pieceId, surface, resolvedId, { message: text, documents })
    },
    onSuccess: ({ conversationId }) => {
      if (pane?.getState().conversationId === null) pane.adoptConversation(conversationId)
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

  const disabled = held || sendMutation.isPending
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
      {streamFailure !== null && (
        <Typography variant="machine" sx={{ display: 'block', mb: 1 }}>
          {STREAM_FAILURE_TEXT[streamFailure]}
        </Typography>
      )}
      {roomUnavailable && (
        <Typography variant="machine" sx={{ display: 'block', mb: 1 }}>
          {ROOM_UNAVAILABLE_TEXT}
        </Typography>
      )}
      {sendMutation.error !== null && (
        <Typography variant="machine" sx={{ display: 'block', mb: 1 }}>
          {sendMutation.error.message}
        </Typography>
      )}
      <Stack spacing={1}>
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
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button variant="quiet" size="small" disabled={disabled} onClick={handleAskMe} sx={{ whiteSpace: 'nowrap' }}>
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
