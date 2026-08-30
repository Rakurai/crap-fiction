import { Box, Stack, Typography, useColorScheme } from '@mui/material'
import type { Theme } from '../../shared/theme.js'
import { participantMarkColor, unseededParticipantMarkColor } from '../theme/participantMark.js'
import type { ParticipantIdentity } from './identity.js'

export function useMarkScheme(): Theme {
  const { mode } = useColorScheme()
  return mode === 'light' ? 'light' : 'dark'
}

function markColor(identity: ParticipantIdentity, scheme: Theme): string {
  return identity.ordinal === null ? unseededParticipantMarkColor(scheme) : participantMarkColor(identity.ordinal, scheme)
}

export type ParticipantMarkProps = Readonly<{ identity: ParticipantIdentity }>

export function ParticipantMark({ identity }: ParticipantMarkProps) {
  const scheme = useMarkScheme()

  return (
    <Box
      aria-hidden
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: markColor(identity, scheme),
        color: scheme === 'dark' ? '#000' : '#fff',
        fontSize: '0.6875rem',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {identity.mark}
    </Box>
  )
}

export type ParticipantNameHandleProps = Readonly<{ identity: ParticipantIdentity }>

export function ParticipantNameHandle({ identity }: ParticipantNameHandleProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
      <Typography variant="room" sx={{ fontWeight: 600 }}>
        {identity.displayName}
      </Typography>
      <Typography variant="machine">{identity.handle}</Typography>
    </Stack>
  )
}

