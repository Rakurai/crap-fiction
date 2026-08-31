import { MenuItem, MenuList, Paper, Popper, Stack } from '@mui/material'
import { ParticipantMark, ParticipantNameHandle } from '../transcript/ParticipantBadge.js'
import type { ParticipantIdentity } from '../transcript/identity.js'

export type HandlePickerProps = Readonly<{
  anchorEl: HTMLElement | null
  matches: readonly ParticipantIdentity[]
  activeIndex: number
  onPick: (identity: ParticipantIdentity) => void
}>

export function HandlePicker({ anchorEl, matches, activeIndex, onPick }: HandlePickerProps) {
  if (anchorEl === null || matches.length === 0) return null

  return (
    <Popper open anchorEl={anchorEl} placement="top-start" sx={{ zIndex: (theme) => theme.zIndex.modal }}>
      <Paper elevation={8} sx={{ minWidth: (theme) => theme.measures.handlePicker, mb: 1 }}>
        <MenuList dense>
          {matches.map((identity, index) => (
            <MenuItem
              key={identity.id}
              selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault()
                onPick(identity)
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <ParticipantMark identity={identity} />
                <ParticipantNameHandle identity={identity} />
              </Stack>
            </MenuItem>
          ))}
        </MenuList>
      </Paper>
    </Popper>
  )
}
