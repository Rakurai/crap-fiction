import { Alert, Box, CircularProgress, DialogContent, DialogTitle, List, ListItem, Stack, Switch, Typography } from '@mui/material'
import type { AddressableParticipantView } from '../../shared/pieceViews.js'
import type { SurfaceId } from '../../shared/surfaces.js'
import { useParticipantIdentities, type ParticipantIdentity } from '../transcript/identity.js'
import { ParticipantMark, ParticipantNameHandle } from '../transcript/ParticipantBadge.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { useSetCast, usePieceDetail } from '../servedFacts/resources.js'

type CastParticipant = Extract<AddressableParticipantView, { eligibility: 'cast' }>

function isCast(participant: AddressableParticipantView): participant is CastParticipant {
  return participant.eligibility === 'cast'
}

export type RoomOverlayProps = Readonly<{ pieceId: string; surface: SurfaceId }>

export function RoomOverlay({ pieceId, surface }: RoomOverlayProps) {
  const detailRead = readState(usePieceDetail(pieceId))
  const detail = presentValue(detailRead)
  const identities = useParticipantIdentities(pieceId, surface)
  const setCast = useSetCast(pieceId)

  if (detail === null) {
    return (
      <DialogContent>
        {detailRead.status === 'failed' ? (
          <Alert severity="error">{detailRead.failure.message}</Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </DialogContent>
    )
  }

  const roster = detail.surfaces[surface].addressable.filter(isCast)
  const enabledIds = roster.filter((member) => member.enabled).map((member) => member.id)
  const storyEditorIdentity: ParticipantIdentity = {
    id: detail.storyEditor.handle,
    handle: detail.storyEditor.handle,
    displayName: detail.storyEditor.displayName,
    mark: detail.storyEditor.mark,
    eligibility: 'generalist',
  }

  function toggle(memberId: string, enabled: boolean): void {
    const ids = enabled ? [...enabledIds, memberId] : enabledIds.filter((id) => id !== memberId)
    setCast.mutate({ surface, ids })
  }

  return (
    <>
      <DialogTitle>Room</DialogTitle>
      <DialogContent>
        {setCast.isError && <Alert severity="error" sx={{ mb: 2 }}>{setCast.error.message}</Alert>}
        <List disablePadding>
          <ListItem>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexGrow: 1 }}>
              <ParticipantMark identity={storyEditorIdentity} />
              <Box sx={{ flexGrow: 1 }}>
                <ParticipantNameHandle identity={storyEditorIdentity} />
                <Typography variant="room">{detail.storyEditor.description}</Typography>
              </Box>
              <Typography variant="machine">Always in the room</Typography>
            </Stack>
          </ListItem>
          {roster.map((member) => {
            const identity = identities.get(member.id)
            if (identity === undefined) return null
            return (
              <ListItem key={member.id}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexGrow: 1 }}>
                  <ParticipantMark identity={identity} />
                  <Box sx={{ flexGrow: 1 }}>
                    <ParticipantNameHandle identity={identity} />
                    <Typography variant="room">{member.description}</Typography>
                  </Box>
                  <Switch
                    checked={member.enabled}
                    onChange={(event) => toggle(member.id, event.target.checked)}
                    color="primary"
                    disabled={setCast.isPending}
                    slotProps={{ input: { 'aria-label': `${member.displayName} in the room` } }}
                  />
                </Stack>
              </ListItem>
            )
          })}
        </List>
      </DialogContent>
    </>
  )
}
