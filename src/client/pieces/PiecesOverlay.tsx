import { type FormEvent, type ReactNode, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'
import { Alert, Box, Button, CircularProgress, Divider, IconButton, List, ListItemButton, ListItemText, MenuItem, Stack, TextField, Toolbar, Typography } from '@mui/material'
import type { ModeSummary } from '../../shared/modeViews.js'
import type { PieceSummary } from '../../shared/pieceViews.js'
import { useFailingSurfaceIds, usePieceSession } from '../pieceSession/PieceSessionProvider.js'
import type { LeaveRefusal } from '../pieceSession/pieceSession.js'
import { presentValue, readState, type ReadState } from '../servedFacts/readState.js'
import { useCreatePiece, useModes, usePieces, useWorkspace } from '../servedFacts/resources.js'
import { FailingDocuments } from '../shell/FailingDocuments.js'
import { formatStamp } from '../stamp.js'

type Pane = Readonly<{ kind: 'piece'; id: string }> | Readonly<{ kind: 'create' }> | Readonly<{ kind: 'nothingChosen' }>

type ModeChoice = Readonly<{ kind: 'sole'; mode: string }> | Readonly<{ kind: 'choose'; modes: readonly ModeSummary[] }>

function modeChoice(modes: readonly ModeSummary[]): ModeChoice | null {
  const [only, ...rest] = modes
  if (only === undefined) return null
  return rest.length === 0 ? { kind: 'sole', mode: only.id } : { kind: 'choose', modes }
}

function refusalMessage(cause: LeaveRefusal): string | null {
  return cause === 'leaveUnderway' ? 'Still leaving the piece that is open — wait for that to finish.' : null
}

function Centered({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      {children}
    </Box>
  )
}

type PiecesOverlayProps = Readonly<{
  openPieceId: string | null
  onOpenPiece: (id: string) => void
  onClosePiece: () => void
  onDismiss: () => void
  onOpenSettings: (() => void) | null
}>

export function PiecesOverlay({ openPieceId, onOpenPiece, onClosePiece, onDismiss, onOpenSettings }: PiecesOverlayProps) {
  const session = usePieceSession()
  const failingSurfaces = useFailingSurfaceIds()
  const piecesRead = readState(usePieces())
  const workspaceRead = readState(useWorkspace())
  const modesRead = readState(useModes())
  const createMutation = useCreatePiece()

  const [pane, setPane] = useState<Pane>(openPieceId === null ? { kind: 'nothingChosen' } : { kind: 'piece', id: openPieceId })
  const [refusal, setRefusal] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const modes = presentValue(modesRead)
  const choice = modes === null ? null : modeChoice(modes)
  const showMode = choice?.kind === 'choose'

  async function leaveThen(onLeft: () => void): Promise<void> {
    setRefusal(null)
    if (session === null) {
      onLeft()
      return
    }
    setLeaving(true)
    try {
      const outcome = await session.requestLeave()
      if (outcome.kind === 'left') onLeft()
      else setRefusal(refusalMessage(outcome.cause))
    } finally {
      setLeaving(false)
    }
  }

  async function goTo(id: string): Promise<void> {
    if (openPieceId === id) {
      setRefusal(null)
      onDismiss()
      return
    }
    await leaveThen(() => onOpenPiece(id))
  }

  async function closeOpenPiece(): Promise<void> {
    await leaveThen(onClosePiece)
  }

  function handleCreate(title: string, mode: string): void {
    createMutation.mutate({ title, mode }, { onSuccess: (created) => goTo(created.id) })
  }

  function choosePiece(id: string): void {
    setRefusal(null)
    setPane({ kind: 'piece', id })
  }

  return (
    <>
      <Toolbar sx={{ gap: 1 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          Pieces
        </Typography>
        <IconButton aria-label="New piece" onClick={() => setPane({ kind: 'create' })} disabled={choice === null || pane.kind === 'create'}>
          <AddIcon />
        </IconButton>
        {onOpenSettings !== null && (
          <IconButton aria-label="Settings" onClick={onOpenSettings}>
            <SettingsIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />

      <Box sx={{ p: 2 }}>
        <Typography variant="h6">crap-fiction</Typography>
        <Typography variant="body2" color="text.secondary">
          A studio for writing fiction with a team of specialist collaborators.
        </Typography>
        <Typography variant="machine" component="p" sx={{ mt: 1 }}>
          {workspaceStatement(workspaceRead)}
        </Typography>
      </Box>
      <Divider />

      {refusal !== null && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setRefusal(null)}>
          {refusal}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flexGrow: 1, minHeight: 0 }}>
        <Box sx={{ minWidth: 0, overflowY: 'auto', borderRight: 1, borderColor: 'divider' }}>
          <PiecesList
            piecesRead={piecesRead}
            openPieceId={openPieceId}
            chosenId={pane.kind === 'piece' ? pane.id : null}
            onChoose={choosePiece}
          />
        </Box>

        <Box sx={{ minWidth: 0, overflowY: 'auto' }}>
          {pane.kind === 'piece' && (
            <PieceDetailPane
              id={pane.id}
              piecesRead={piecesRead}
              modes={modes ?? []}
              showMode={showMode}
              isOpen={openPieceId === pane.id}
              leaving={leaving}
              leaveHeld={failingSurfaces.length > 0}
              onOpen={() => goTo(pane.id)}
              onClose={closeOpenPiece}
            />
          )}

          {pane.kind === 'nothingChosen' && (
            <Typography variant="machine" component="p" sx={{ p: 2 }}>
              Choose a piece to see what is in it.
            </Typography>
          )}

          {pane.kind === 'create' &&
            (choice === null ? (
              <Typography sx={{ p: 2 }} color="text.secondary">
                No modes are loaded, so there is nothing to start a piece from.
              </Typography>
            ) : (
              <CreatePieceForm
                choice={choice}
                pending={createMutation.isPending}
                error={createMutation.error?.message ?? null}
                onCreate={handleCreate}
                onAbandon={() => setPane(openPieceId === null ? { kind: 'nothingChosen' } : { kind: 'piece', id: openPieceId })}
              />
            ))}
        </Box>
      </Box>
    </>
  )
}

function workspaceStatement(workspaceRead: ReadState<string | null>): string {
  const workspace = presentValue(workspaceRead)
  return workspace === null || workspace === '' ? 'The workspace directory could not be read.' : `Kept in ${workspace}`
}

function pieceFacts(piece: PieceSummary, isOpen: boolean): string {
  const facts = [`${piece.length} words`, `touched ${formatStamp(piece.modified)}`]
  return (isOpen ? ['open', ...facts] : facts).join(' · ')
}

type PiecesListProps = Readonly<{
  piecesRead: ReadState<readonly PieceSummary[]>
  openPieceId: string | null
  chosenId: string | null
  onChoose: (id: string) => void
}>

function PiecesList({ piecesRead, openPieceId, chosenId, onChoose }: PiecesListProps) {
  const pieces = presentValue(piecesRead)

  if (pieces === null) {
    if (piecesRead.status === 'failed') return <Alert severity="error" sx={{ m: 2 }}>{piecesRead.failure.message}</Alert>
    return <Centered><CircularProgress size={24} /></Centered>
  }

  return (
    <>
      {piecesRead.status === 'refreshFailed' && (
        <Alert severity="warning" sx={{ m: 2 }}>{piecesRead.failure.message}</Alert>
      )}
      {pieces.length === 0 ? (
        <Typography sx={{ p: 2 }} color="text.secondary">No pieces yet.</Typography>
      ) : (
        <List disablePadding>
          {pieces.map((piece) => (
            <ListItemButton key={piece.id} onClick={() => onChoose(piece.id)} selected={piece.id === chosenId}>
              <ListItemText
                primary={piece.title}
                secondary={pieceFacts(piece, piece.id === openPieceId)}
                slotProps={{ primary: { noWrap: true }, secondary: { variant: 'machine' } }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </>
  )
}

type PieceDetailPaneProps = Readonly<{
  id: string
  piecesRead: ReadState<readonly PieceSummary[]>
  modes: readonly ModeSummary[]
  showMode: boolean
  isOpen: boolean
  leaving: boolean
  leaveHeld: boolean
  onOpen: () => void
  onClose: () => void
}>

function PieceDetailPane({ id, piecesRead, modes, showMode, isOpen, leaving, leaveHeld, onOpen, onClose }: PieceDetailPaneProps) {
  const piece = (presentValue(piecesRead) ?? []).find((candidate) => candidate.id === id)
  if (piece === undefined) return <Alert severity="error" sx={{ m: 2 }}>This piece is no longer listed.</Alert>

  const modeLabel = modes.find((mode) => mode.id === piece.mode)?.displayName ?? piece.mode

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h6">{piece.title}</Typography>
      {showMode && <Typography variant="machine">{modeLabel}</Typography>}
      <Typography variant="machine">{pieceFacts(piece, isOpen)}</Typography>
      {isOpen ? (
        <Button variant="destructive" onClick={onClose} disabled={leaving || leaveHeld}>
          {leaving ? 'Leaving…' : 'Close piece'}
        </Button>
      ) : (
        <Button variant="affirm" onClick={onOpen} disabled={leaving || leaveHeld}>
          {leaving ? 'Opening…' : 'Open'}
        </Button>
      )}
      {leaveHeld && (
        <Stack spacing={0.5}>
          <FailingDocuments />
          <Typography variant="machine">Leaving becomes available the moment it saves.</Typography>
        </Stack>
      )}
    </Stack>
  )
}

type CreatePieceFormProps = Readonly<{
  choice: ModeChoice
  pending: boolean
  error: string | null
  onCreate: (title: string, mode: string) => void
  onAbandon: () => void
}>

function CreatePieceForm({ choice, pending, error, onCreate, onAbandon }: CreatePieceFormProps) {
  const [title, setTitle] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const trimmed = title.trim()
  const mode = choice.kind === 'sole' ? choice.mode : picked

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    if (trimmed === '' || mode === null) return
    onCreate(trimmed, mode)
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ p: 2 }}>
      <Typography variant="h6">New piece</Typography>
      {error !== null && <Alert severity="error">{error}</Alert>}
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus fullWidth disabled={pending} />
      {choice.kind === 'choose' && (
        <TextField select label="Mode" value={picked ?? ''} onChange={(event) => setPicked(event.target.value)} fullWidth disabled={pending}>
          {choice.modes.map((candidate) => (
            <MenuItem key={candidate.id} value={candidate.id}>
              {candidate.displayName}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="affirm" disabled={pending || trimmed === '' || mode === null}>
          {pending ? 'Creating…' : 'Create'}
        </Button>
        <Button variant="quiet" onClick={onAbandon} disabled={pending}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  )
}
