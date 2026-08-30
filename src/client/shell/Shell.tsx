import { Alert, Box } from '@mui/material'
import { ErrorBoundary } from 'react-error-boundary'
import { Document } from '../document/Document.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { usePieceDetail } from '../servedFacts/resources.js'
import { TranscriptColumn } from '../transcript/TranscriptColumn.js'
import { OverlayHost } from './OverlayHost.js'
import { ReadingExit, useReadingEscape } from './Reading.js'
import type { ShellState } from './state.js'
import { WorkspaceBanner } from './WorkspaceBanner.js'
import { WorkspaceBar } from './WorkspaceBar.js'

function ShellCrashed() {
  return (
    <Box sx={{ p: 4 }}>
      <Alert severity="error">Something went wrong drawing the studio.</Alert>
    </Box>
  )
}

export type ShellProps = Readonly<{ shell: ShellState }>

export function Shell({ shell }: ShellProps) {
  const pieceOpen = shell.openPieceId !== null
  const isReading = shell.reading && shell.activeSurface === 'draft' && pieceOpen

  useReadingEscape(isReading, shell.leaveReading)

  const detail = presentValue(readState(usePieceDetail(shell.openPieceId)))
  const pieceTitle = detail?.title ?? null

  return (
    <ErrorBoundary fallback={<ShellCrashed />}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {!isReading && (
          <WorkspaceBar
            pieceOpen={pieceOpen}
            activeSurface={shell.activeSurface}
            onSelectSurface={shell.selectSurface}
            onOpenOverlay={shell.setOverlay}
            onEnterReading={shell.enterReading}
          />
        )}

        <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
          <Document activeSurface={shell.activeSurface} presentation={isReading ? 'rendered' : shell.presentation} />
          {!isReading && pieceOpen && <TranscriptColumn activeSurface={shell.activeSurface} />}
        </Box>

        {!isReading && pieceOpen && (
          <WorkspaceBanner
            title={pieceTitle}
            presentation={shell.presentation}
            onPresentationChange={shell.setPresentation}
            showPresentationToggle={shell.activeSurface === 'draft'}
          />
        )}

        {isReading && <ReadingExit />}

        <OverlayHost overlay={shell.overlay} dismissable={pieceOpen} onDismiss={() => shell.setOverlay(null)} />
      </Box>
    </ErrorBoundary>
  )
}
