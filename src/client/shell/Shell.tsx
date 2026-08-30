import { Alert, Box } from '@mui/material'
import { ErrorBoundary } from 'react-error-boundary'
import { countWords } from '../../shared/storyLength.js'
import { presentValue, readState } from '../servedFacts/readState.js'
import { usePieceDetail } from '../servedFacts/resources.js'
import { OverlayHost } from './OverlayHost.js'
import { ReadingExit, useReadingEscape } from './Reading.js'
import { useShellState } from './state.js'
import { WorkspaceBanner } from './WorkspaceBanner.js'
import { WorkspaceBar } from './WorkspaceBar.js'

const NO_FAILING_DOCUMENTS: readonly string[] = []

function ShellCrashed() {
  return (
    <Box sx={{ p: 4 }}>
      <Alert severity="error">Something went wrong drawing the studio.</Alert>
    </Box>
  )
}

export function Shell() {
  const shell = useShellState()
  const pieceOpen = shell.openPieceId !== null
  const isReading = shell.reading && shell.activeSurface === 'draft' && pieceOpen

  useReadingEscape(isReading, shell.leaveReading)

  const detail = presentValue(readState(usePieceDetail(shell.openPieceId)))
  const pieceTitle = detail?.title ?? null
  const wordCount = detail === null ? 0 : countWords(detail.surfaces.draft.text)

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
          <Box sx={{ flexGrow: 1, minWidth: 0 }} />
          {!isReading && pieceOpen && <Box sx={{ width: (theme) => theme.spacing(45), flexShrink: 0 }} />}
        </Box>

        {!isReading && pieceOpen && (
          <WorkspaceBanner
            title={pieceTitle}
            wordCount={wordCount}
            presentation={shell.presentation}
            onPresentationChange={shell.setPresentation}
            showPresentationToggle={shell.activeSurface === 'draft'}
            failingDocuments={NO_FAILING_DOCUMENTS}
          />
        )}

        {isReading && <ReadingExit failingDocuments={NO_FAILING_DOCUMENTS} />}

        <OverlayHost overlay={shell.overlay} dismissable={pieceOpen} onDismiss={() => shell.setOverlay(null)} />
      </Box>
    </ErrorBoundary>
  )
}
