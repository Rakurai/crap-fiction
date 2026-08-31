import type { ReactNode } from 'react'
import { Dialog, Drawer } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import type { OverlayId } from './state.js'

export type OverlayHostProps = Readonly<{
  overlay: OverlayId | null
  dismissable: boolean
  onDismiss: () => void
  children: ReactNode
}>

type SideOverlay = Readonly<{ anchor: 'left' | 'right'; paperSx: SxProps<Theme> }>

const AS_A_COLUMN = { display: 'flex', flexDirection: 'column' } as const

const SIDE_OVERLAYS: Readonly<Record<'pieces' | 'conversations', SideOverlay>> = {
  pieces: { anchor: 'left', paperSx: { ...AS_A_COLUMN, width: (theme) => theme.spacing(80), maxWidth: '100vw' } },
  conversations: { anchor: 'right', paperSx: { ...AS_A_COLUMN, minWidth: (theme) => theme.spacing(45) } },
}

export function OverlayHost({ overlay, dismissable, onDismiss, children }: OverlayHostProps) {
  const handleClose = () => {
    if (dismissable) onDismiss()
  }

  if (overlay === 'pieces' || overlay === 'conversations') {
    return (
      <Drawer
        anchor={SIDE_OVERLAYS[overlay].anchor}
        open
        onClose={handleClose}
        slotProps={{
          paper: { sx: SIDE_OVERLAYS[overlay].paperSx },
          ...(overlay === 'conversations' ? { backdrop: { invisible: true } } : {}),
        }}
      >
        {children}
      </Drawer>
    )
  }

  if (overlay === 'room' || overlay === 'settings') {
    return (
      <Dialog
        open
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { minHeight: (theme) => theme.spacing(30) } } }}
      >
        {children}
      </Dialog>
    )
  }

  return null
}
