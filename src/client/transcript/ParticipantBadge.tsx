import { Box, Stack, Typography, useColorScheme } from '@mui/material'
import type { Theme } from '../../shared/theme.js'
import {
  MARK_DIAMETER,
  MARK_GLYPH_SIZE,
  MARK_GLYPH_WEIGHT,
  participantMarkColor,
  participantMarkGlyphColor,
  unseededParticipantMarkColor,
} from '../theme/participantMark.js'
import type { ParticipantIdentity } from './identity.js'

export function useMarkScheme(): Theme {
  const { mode } = useColorScheme()
  return mode === 'light' ? 'light' : 'dark'
}

function markColor(identity: ParticipantIdentity, scheme: Theme): string {
  return identity.eligibility === 'generalist' ? unseededParticipantMarkColor(scheme) : participantMarkColor(identity.ordinal, scheme)
}

export type ParticipantMarkProps = Readonly<{ identity: ParticipantIdentity }>

export function ParticipantMark({ identity }: ParticipantMarkProps) {
  const scheme = useMarkScheme()

  return (
    <Box
      aria-hidden
      sx={{
        width: MARK_DIAMETER,
        height: MARK_DIAMETER,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: markColor(identity, scheme),
        color: participantMarkGlyphColor(scheme),
        fontSize: MARK_GLYPH_SIZE,
        fontWeight: MARK_GLYPH_WEIGHT,
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

