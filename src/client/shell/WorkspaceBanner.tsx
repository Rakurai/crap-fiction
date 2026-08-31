import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { FailingDocuments } from './FailingDocuments.js'
import type { DocumentPresentation } from './state.js'
import { WordCount } from './WordCount.js'

type WorkspaceBannerProps = Readonly<{
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
      spacing={2}
      sx={{ flexShrink: 0, minWidth: 0, py: 1, px: 2, alignItems: 'center', justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}
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
  )
}
