import { Box, Stack, Typography } from '@mui/material'
import type { Theme } from '../../shared/theme.js'
import { participantMarkColor, participantMarkGlyphColor, unseededParticipantMarkColor } from '../theme/participantMark.js'
import type { ParticipantIdentity } from './identity.js'

function markColors(identity: ParticipantIdentity, scheme: Theme) {
  return {
    bgcolor: identity.eligibility === 'generalist' ? unseededParticipantMarkColor(scheme) : participantMarkColor(identity.ordinal, scheme),
    color: participantMarkGlyphColor(scheme),
  }
}

export type ParticipantMarkProps = Readonly<{ identity: ParticipantIdentity }>

export function ParticipantMark({ identity }: ParticipantMarkProps) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: theme.participantMark.diameter,
        height: theme.participantMark.diameter,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...markColors(identity, 'dark'),
        ...theme.applyStyles('light', markColors(identity, 'light')),
        fontSize: theme.participantMark.glyphSize,
        fontWeight: theme.participantMark.glyphWeight,
        lineHeight: 1,
      })}
    >
      {identity.mark}
    </Box>
  )
}

export type ParticipantNameHandleProps = Readonly<{ identity: ParticipantIdentity }>

export function ParticipantNameHandle({ identity }: ParticipantNameHandleProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
      <Typography variant="speaker">{identity.displayName}</Typography>
      <Typography variant="machine">{identity.handle}</Typography>
    </Stack>
  )
}

