import { type FormEvent, type ReactNode, useState } from 'react'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { presentValue, readState } from '../servedFacts/readState.js'
import { useSetWorkspace, useWorkspace } from '../servedFacts/resources.js'

export type WorkspaceGateProps = Readonly<{ children: ReactNode }>

export function WorkspaceGate({ children }: WorkspaceGateProps) {
  const query = useWorkspace()
  const read = readState(query)

  if (read.status === 'notArrived') return null

  const configured = presentValue(read) !== null
  if (configured) return <>{children}</>

  return <DirectoryAsk unavailable={read.status === 'failed'} />
}

function DirectoryAsk({ unavailable }: Readonly<{ unavailable: boolean }>) {
  const [candidate, setCandidate] = useState('')
  const mutation = useSetWorkspace()
  const trimmed = candidate.trim()

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (trimmed === '') return
    mutation.mutate(trimmed)
  }

  return (
    <Box
      component="main"
      sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', p: 4 }}
    >
      <Stack component="form" onSubmit={handleSubmit} spacing={3} sx={{ width: '100%', maxWidth: (theme) => theme.spacing(60) }}>
        <Typography variant="h5">crap-fiction</Typography>
        <Typography variant="body1">Where does this studio keep its pieces?</Typography>

        {unavailable && <Alert severity="error">the workspace could not be read</Alert>}
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
    </Box>
  )
}
