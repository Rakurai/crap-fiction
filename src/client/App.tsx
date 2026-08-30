import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import { participantMarkColor } from './theme/participantMark.js'
import { useServerColorScheme } from './theme/useServerColorScheme.js'

const MARK_ORDINALS = [0, 1, 2, 3] as const

export function App() {
  const { state, choose } = useServerColorScheme()
  const scheme = state.status === 'confirmed' ? state.theme : 'dark'
  const nextScheme = scheme === 'dark' ? 'light' : 'dark'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', p: 4 }}>
      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <Typography variant="h5">crap-fiction</Typography>

        {state.status !== 'confirmed' && state.status !== 'loading' && (
          <Alert severity="info" variant="outlined">
            {state.status === 'unavailable'
              ? 'the saved appearance could not be loaded — showing the default'
              : 'no saved appearance yet — showing the default'}
          </Alert>
        )}

        <Stack spacing={1}>
          <Typography variant="prose">Prose register — the work itself, set in Spectral.</Typography>
          <Typography variant="room">Room register — what a participant says about the work.</Typography>
          <Typography variant="author">Author register — the author's own words to the room.</Typography>
          <Typography variant="machine">Machine register — 0 words</Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {MARK_ORDINALS.map((ordinal) => (
            <Box
              key={ordinal}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.75rem',
                bgcolor: participantMarkColor(ordinal, scheme),
              }}
            >
              {ordinal}
            </Box>
          ))}
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button variant="affirm" onClick={() => choose(nextScheme)}>
            switch to {nextScheme}
          </Button>
          <Button variant="quiet">quiet weight</Button>
          <Button variant="destructive">destructive weight</Button>
        </Stack>
      </Stack>
    </Box>
  )
}
