import { useEffect } from 'react'
import { Stack, Typography } from '@mui/material'
import { FailingDocuments } from './FailingDocuments.js'

export function useReadingEscape(active: boolean, onExit: () => void): void {
  useEffect(() => {
    if (!active) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, onExit])
}

export function ReadingExit() {
  return (
    <Stack
      spacing={0.5}
      sx={{ position: 'fixed', insetInlineStart: (theme) => theme.spacing(2), insetBlockEnd: (theme) => theme.spacing(2), alignItems: 'flex-start' }}
    >
      <Typography variant="machine">Esc to leave reading</Typography>
      <FailingDocuments />
    </Stack>
  )
}
