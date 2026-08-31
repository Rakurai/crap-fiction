import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { FailingDocuments } from './FailingDocuments.js'
import { transcriptColumnWidth } from './regions.js'
import type { DocumentPresentation } from './state.js'
import { WordCount } from './WordCount.js'

export type WorkspaceBannerProps = Readonly<{
  title: string | null
  presentation: DocumentPresentation
  onPresentationChange: (presentation: DocumentPresentation) => void
  showPresentationToggle: boolean
}>

export function WorkspaceBanner({ title, presentation, onPresentationChange, showPresentationToggle }: WorkspaceBannerProps) {
  return (
    <Stack direction="row" component="footer" sx={{ alignItems: 'center', py: 1, borderTop: 1, borderColor: 'divider' }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ flexGrow: 1, minWidth: 0, px: 2, alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Stack direction="row" spacing={2} sx={{ minWidth: 0, alignItems: 'center' }}>
          {title !== null && <Typography variant="machine">{title}</Typography>}
          <WordCount surface="draft" />
          <FailingDocuments />
        </Stack>

        {showPresentationToggle && (
          <ToggleButtonGroup
            value={presentation}
            exclusive
            size="small"
            onChange={(_event, value: DocumentPresentation | null) => {
              if (value !== null) onPresentationChange(value)
            }}
            aria-label="Manuscript presentation"
          >
            <ToggleButton value="rendered">Rendered</ToggleButton>
            <ToggleButton value="source">Source</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>

      <Box sx={{ width: transcriptColumnWidth, flexShrink: 0 }} />
    </Stack>
  )
}
