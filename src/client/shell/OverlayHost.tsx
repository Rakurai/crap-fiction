import type { ReactNode } from 'react'
import { Dialog, Drawer } from '@mui/material'
import type { OverlayId } from './state.js'

export type OverlayHostProps = Readonly<{
  overlay: OverlayId | null
  dismissable: boolean
  onDismiss: () => void
  children: ReactNode
}>

const SIDE_ANCHOR: Readonly<Record<'pieces' | 'conversations', 'left' | 'right'>> = {
  pieces: 'left',
  conversations: 'right',
}

export function OverlayHost({ overlay, dismissable, onDismiss, children }: OverlayHostProps) {
  const handleClose = () => {
    if (dismissable) onDismiss()
  }

  if (overlay === 'pieces' || overlay === 'conversations') {
    return (
      <Drawer
        anchor={SIDE_ANCHOR[overlay]}
        open
        onClose={handleClose}
        slotProps={{
          paper: { sx: { minWidth: (theme) => theme.spacing(45), display: 'flex', flexDirection: 'column' } },
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
