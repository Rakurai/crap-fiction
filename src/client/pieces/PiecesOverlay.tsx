import { type FormEvent, type ReactNode, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Alert, Box, Button, CircularProgress, Divider, IconButton, List, ListItemButton, ListItemText, MenuItem, Stack, TextField, Toolbar, Typography } from '@mui/material'
import type { ModeSummary } from '../../shared/modeViews.js'
import type { PieceSummary } from '../../shared/pieceViews.js'
import { SURFACE_IDS } from '../../shared/surfaces.js'
import { usePieceSession } from '../pieceSession/PieceSessionProvider.js'
import type { PieceSession } from '../pieceSession/pieceSession.js'
import { presentValue, readState, type ReadState } from '../servedFacts/readState.js'
import { useCreatePiece, useModes, usePieces, useWorkspace } from '../servedFacts/resources.js'
import { SURFACE_LABEL, type ShellState } from '../shell/state.js'

type View = Readonly<{ kind: 'list' }> | Readonly<{ kind: 'detail'; id: string }> | Readonly<{ kind: 'create' }>

function refusalMessage(session: PieceSession): string {
  const failing = SURFACE_IDS.filter((surface) => session.surfaces[surface].document.getFailing()).map((surface) => SURFACE_LABEL[surface])
  return `Can't leave yet — ${failing.length > 0 ? failing.join(', ') : 'a document'} failed to save.`
}

function Centered({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      {children}
    </Box>
  )
}

export type PiecesOverlayProps = Readonly<{ shell: ShellState }>

export function PiecesOverlay({ shell }: PiecesOverlayProps) {
  const session = usePieceSession()
  const piecesRead = readState(usePieces())
  const workspaceRead = readState(useWorkspace())
  const modesRead = readState(useModes())
  const createMutation = useCreatePiece()

  const [view, setView] = useState<View>({ kind: 'list' })
  const [refusal, setRefusal] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const modes = presentValue(modesRead)
  const showMode = (modes?.length ?? 0) > 1

  async function goTo(id: string): Promise<void> {
    setRefusal(null)
    if (shell.openPieceId === id) {
      shell.setOverlay(null)
      return
    }
    if (session === null) {
      shell.openPiece(id)
      shell.setOverlay(null)
      return
    }
    setLeaving(true)
    try {
      const outcome = await session.requestLeave()
      if (outcome === 'left') {
        shell.openPiece(id)
        shell.setOverlay(null)
      } else {
        setRefusal(refusalMessage(session))
      }
    } finally {
      setLeaving(false)
    }
  }

  async function closeOpenPiece(): Promise<void> {
    setRefusal(null)
    if (session === null) return
    setLeaving(true)
    try {
      const outcome = await session.requestLeave()
      if (outcome === 'left') {
        shell.closePiece()
        setView({ kind: 'list' })
      } else {
        setRefusal(refusalMessage(session))
      }
    } finally {
      setLeaving(false)
    }
  }

  async function handleCreate(title: string, mode: string): Promise<void> {
    const created = await createMutation.mutateAsync({ title, mode })
    await goTo(created.id)
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
          <IconButton aria-label="New piece" onClick={() => setView({ kind: 'create' })} disabled={modes === null}>
            <AddIcon />
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
            <PiecesList piecesRead={piecesRead} openPieceId={shell.openPieceId} onSelect={(id) => setView({ kind: 'detail', id })} />
          </>
        )}

        {view.kind === 'detail' && (
          <PieceDetailPane
            id={view.id}
            piecesRead={piecesRead}
            modes={modes ?? []}
            showMode={showMode}
            isOpen={shell.openPieceId === view.id}
            leaving={leaving}
            onOpen={() => goTo(view.id)}
            onClose={closeOpenPiece}
          />
        )}

        {view.kind === 'create' && modes !== null && (
          <CreatePieceForm
            modes={modes}
            showMode={showMode}
            pending={createMutation.isPending}
            error={createMutation.error?.message ?? null}
            onCreate={handleCreate}
          />
        )}
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
  modes: readonly ModeSummary[]
  showMode: boolean
  pending: boolean
  error: string | null
  onCreate: (title: string, mode: string) => void
}>

function CreatePieceForm({ modes, showMode, pending, error, onCreate }: CreatePieceFormProps) {
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState(modes[0]?.id ?? '')
  const trimmed = title.trim()

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    if (trimmed === '' || mode === '') return
    onCreate(trimmed, mode)
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ p: 2 }}>
      {error !== null && <Alert severity="error">{error}</Alert>}
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus fullWidth disabled={pending} />
      {showMode && (
        <TextField select label="Mode" value={mode} onChange={(event) => setMode(event.target.value)} fullWidth disabled={pending}>
          {modes.map((candidate) => (
            <MenuItem key={candidate.id} value={candidate.id}>
              {candidate.displayName}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Button type="submit" variant="affirm" disabled={pending || trimmed === '' || mode === ''}>
        {pending ? 'Creating…' : 'Create'}
      </Button>
    </Stack>
  )
}
