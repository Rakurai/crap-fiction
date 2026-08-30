import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { FailingDocuments } from './FailingDocuments.js'
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
    <Stack
      direction="row"
      component="footer"
      sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
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
  )
}
