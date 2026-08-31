import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { SURFACE_IDS, type SurfaceId } from '../../shared/surfaces.js'
import { Composer } from '../composer/Composer.js'
import { usePieceSession } from '../pieceSession/PieceSessionProvider.js'
import { Transcript } from './Transcript.js'

function Panel({ active, children }: Readonly<{ active: boolean; children: ReactNode }>) {
  return <Box sx={{ display: active ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0 }}>{children}</Box>
}

export type TranscriptColumnProps = Readonly<{ activeSurface: SurfaceId }>

export function TranscriptColumn({ activeSurface }: TranscriptColumnProps) {
  const session = usePieceSession()
  if (session === null) return null

  return (
    <Box
      key={session.pieceId}
      sx={{ width: (theme) => theme.measures.transcript, flexShrink: 0, height: '100%', borderLeft: '1px solid', borderColor: 'divider' }}
    >
      {SURFACE_IDS.map((surface) => (
        <Panel key={surface} active={activeSurface === surface}>
          <Transcript pieceId={session.pieceId} surface={surface} />
          <Composer pieceId={session.pieceId} surface={surface} />
        </Panel>
      ))}
    </Box>
  )
}
