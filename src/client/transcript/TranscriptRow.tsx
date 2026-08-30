import type { ReactNode } from 'react'
import { Box } from '@mui/material'

export type TranscriptRowProps = Readonly<{ gutter: ReactNode; children: ReactNode }>

export function TranscriptRow({ gutter, children }: TranscriptRowProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 1.5, alignItems: 'start' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>{gutter}</Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  )
}
