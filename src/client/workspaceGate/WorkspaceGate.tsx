import { type FormEvent, type ReactNode, useState } from 'react'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { presentValue, readState } from '../servedFacts/readState.js'
import { useSetWorkspace, useWorkspace } from '../servedFacts/resources.js'

export type WorkspaceGateProps = Readonly<{ children: ReactNode }>

export function WorkspaceGate({ children }: WorkspaceGateProps) {
  const query = useWorkspace()
  const read = readState(query)

  if (read.status === 'notArrived') return null

  if (read.status === 'failed') {
    return <WorkspaceUnknown message={read.failure.message} rereading={query.isFetching} onReread={() => void query.refetch()} />
  }

  const configured = presentValue(read) !== null
  if (configured) return <>{children}</>

  return <DirectoryAsk />
}

type WorkspaceUnknownProps = Readonly<{
  message: string
  rereading: boolean
  onReread: () => void
}>

function WorkspaceUnknown({ message, rereading, onReread }: WorkspaceUnknownProps) {
  return (
    <GateSurface>
      <Stack spacing={3}>
        <Typography variant="h5">crap-fiction</Typography>
        <Alert severity="error">{message}</Alert>
        <Typography variant="body1">
          The studio cannot tell whether a workspace is already set, so it is not asking for one.
        </Typography>
        <Button variant="affirm" onClick={onReread} disabled={rereading}>
          Try again
        </Button>
      </Stack>
    </GateSurface>
  )
}

function DirectoryAsk() {
  const [candidate, setCandidate] = useState('')
  const mutation = useSetWorkspace()
  const trimmed = candidate.trim()

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (trimmed === '') return
    mutation.mutate(trimmed)
  }

  return (
    <GateSurface>
      <Stack component="form" onSubmit={handleSubmit} spacing={3}>
        <Typography variant="h5">crap-fiction</Typography>
        <Typography variant="body1">Where does this studio keep its pieces?</Typography>

        {mutation.isError && <Alert severity="error">{mutation.error.message}</Alert>}

        <TextField
          label="Workspace directory"
          value={candidate}
          onChange={(event) => setCandidate(event.target.value)}
          disabled={mutation.isPending}
          autoFocus
          fullWidth
        />

        <Button type="submit" variant="affirm" disabled={mutation.isPending || trimmed === ''}>
          Use this workspace
        </Button>
      </Stack>
    </GateSurface>
  )
}

function GateSurface({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box component="main" sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', p: 4 }}>
      <Box sx={{ width: '100%', maxWidth: (theme) => theme.measures.workspaceGate }}>{children}</Box>
    </Box>
  )
}
