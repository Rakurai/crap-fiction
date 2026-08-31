import { type FormEvent, type ReactNode, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SettingsIcon from '@mui/icons-material/Settings'
import { Alert, Box, Button, CircularProgress, Divider, IconButton, List, ListItemButton, ListItemText, MenuItem, Stack, TextField, Toolbar, Typography } from '@mui/material'
import type { ModeSummary } from '../../shared/modeViews.js'
import type { PieceSummary } from '../../shared/pieceViews.js'
import { SURFACE_IDS } from '../../shared/surfaces.js'
import { usePieceSession } from '../pieceSession/PieceSessionProvider.js'
import type { LeaveRefusal, PieceSession } from '../pieceSession/pieceSession.js'
import { presentValue, readState, type ReadState } from '../servedFacts/readState.js'
import { useCreatePiece, useModes, usePieces, useWorkspace } from '../servedFacts/resources.js'
import { SURFACE_LABEL } from '../shell/state.js'

type View = Readonly<{ kind: 'list' }> | Readonly<{ kind: 'detail'; id: string }> | Readonly<{ kind: 'create' }>

type ModeChoice = Readonly<{ kind: 'sole'; mode: string }> | Readonly<{ kind: 'choose'; modes: readonly ModeSummary[] }>

function modeChoice(modes: readonly ModeSummary[]): ModeChoice | null {
  const [only, ...rest] = modes
  if (only === undefined) return null
  return rest.length === 0 ? { kind: 'sole', mode: only.id } : { kind: 'choose', modes }
}

function refusalMessage(session: PieceSession, cause: LeaveRefusal): string {
  if (cause === 'leaveUnderway') return 'Still leaving the piece that is open — wait for that to finish.'
  const failing = SURFACE_IDS.filter((surface) => session.surfaces[surface].document.getFailing()).map((surface) => SURFACE_LABEL[surface])
  return `Can't leave yet — ${failing.join(', ')} failed to save.`
}

function Centered({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      {children}
    </Box>
  )
}

export type PiecesOverlayProps = Readonly<{
  openPieceId: string | null
  onOpenPiece: (id: string) => void
  onClosePiece: () => void
  onDismiss: () => void
  onOpenSettings: (() => void) | null
}>

export function PiecesOverlay({ openPieceId, onOpenPiece, onClosePiece, onDismiss, onOpenSettings }: PiecesOverlayProps) {
  const session = usePieceSession()
  const piecesRead = readState(usePieces())
  const workspaceRead = readState(useWorkspace())
  const modesRead = readState(useModes())
  const createMutation = useCreatePiece()

  const [view, setView] = useState<View>({ kind: 'list' })
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
      else setRefusal(refusalMessage(session, outcome.cause))
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
    await leaveThen(() => {
      onClosePiece()
      setView({ kind: 'list' })
    })
  }

  function handleCreate(title: string, mode: string): void {
    createMutation.mutate({ title, mode }, { onSuccess: (created) => goTo(created.id) })
  }

  return (
    <>
      <Toolbar sx={{ gap: 1 }}>
        {view.kind !== 'list' && (
          <IconButton aria-label="Back to pieces" onClick={() => setView({ kind: 'list' })}>
            <ArrowBackIcon />
          </IconButton>
        )}
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          {view.kind === 'create' ? 'New piece' : 'Pieces'}
        </Typography>
        {view.kind === 'list' && (
          <IconButton aria-label="New piece" onClick={() => setView({ kind: 'create' })} disabled={choice === null}>
            <AddIcon />
          </IconButton>
        )}
        {view.kind === 'list' && onOpenSettings !== null && (
          <IconButton aria-label="Settings" onClick={onOpenSettings}>
            <SettingsIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />

      {refusal !== null && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setRefusal(null)}>
          {refusal}
        </Alert>
      )}

      <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>
        {view.kind === 'list' && (
          <>
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
            <PiecesList piecesRead={piecesRead} openPieceId={openPieceId} onSelect={(id) => setView({ kind: 'detail', id })} />
          </>
        )}

        {view.kind === 'detail' && (
          <PieceDetailPane
            id={view.id}
            piecesRead={piecesRead}
            modes={modes ?? []}
            showMode={showMode}
            isOpen={openPieceId === view.id}
            leaving={leaving}
            onOpen={() => goTo(view.id)}
            onClose={closeOpenPiece}
          />
        )}

        {view.kind === 'create' &&
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
            />
          ))}
      </Box>
    </>
  )
}

function workspaceStatement(workspaceRead: ReadState<string | null>): string {
  const workspace = presentValue(workspaceRead)
  return workspace === null || workspace === '' ? 'The workspace directory could not be read.' : `Kept in ${workspace}`
}

type PiecesListProps = Readonly<{
  piecesRead: ReadState<readonly PieceSummary[]>
  openPieceId: string | null
  onSelect: (id: string) => void
}>

function PiecesList({ piecesRead, openPieceId, onSelect }: PiecesListProps) {
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
            <ListItemButton key={piece.id} onClick={() => onSelect(piece.id)} selected={piece.id === openPieceId}>
              <ListItemText primary={piece.title} secondary={piece.id === openPieceId ? 'Currently open' : undefined} />
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
  onOpen: () => void
  onClose: () => void
}>

function PieceDetailPane({ id, piecesRead, modes, showMode, isOpen, leaving, onOpen, onClose }: PieceDetailPaneProps) {
  const piece = (presentValue(piecesRead) ?? []).find((candidate) => candidate.id === id)
  if (piece === undefined) return <Alert severity="error" sx={{ m: 2 }}>This piece is no longer listed.</Alert>

  const modeLabel = modes.find((mode) => mode.id === piece.mode)?.displayName ?? piece.mode

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Typography variant="h6">{piece.title}</Typography>
      {showMode && <Typography variant="machine">{modeLabel}</Typography>}
      <Typography variant="machine">{piece.length} words</Typography>
      {isOpen ? (
        <Button variant="destructive" onClick={onClose} disabled={leaving}>
          {leaving ? 'Leaving…' : 'Close piece'}
        </Button>
      ) : (
        <Button variant="affirm" onClick={onOpen} disabled={leaving}>
          {leaving ? 'Opening…' : 'Open'}
        </Button>
      )}
    </Stack>
  )
}

type CreatePieceFormProps = Readonly<{
  choice: ModeChoice
  pending: boolean
  error: string | null
  onCreate: (title: string, mode: string) => void
}>

function CreatePieceForm({ choice, pending, error, onCreate }: CreatePieceFormProps) {
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
      <Button type="submit" variant="affirm" disabled={pending || trimmed === '' || mode === null}>
        {pending ? 'Creating…' : 'Create'}
      </Button>
    </Stack>
  )
}
