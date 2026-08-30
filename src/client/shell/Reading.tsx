import { useEffect } from 'react'
import { Box, Typography } from '@mui/material'

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

export type ReadingExitProps = Readonly<{
  failingDocuments: readonly string[]
}>

export function ReadingExit({ failingDocuments }: ReadingExitProps) {
  return (
    <Box sx={{ position: 'fixed', insetInlineStart: (theme) => theme.spacing(2), insetBlockEnd: (theme) => theme.spacing(2) }}>
      <Typography variant="machine">Esc to leave reading</Typography>
      {failingDocuments.map((label) => (
        <Typography key={label} variant="machine" color="error" component="div">
          {label} is not saving
        </Typography>
      ))}
    </Box>
  )
}
