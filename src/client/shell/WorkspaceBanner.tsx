import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { DocumentPresentation } from './state.js'

export type WorkspaceBannerProps = Readonly<{
  title: string | null
  wordCount: number
  presentation: DocumentPresentation
  onPresentationChange: (presentation: DocumentPresentation) => void
  showPresentationToggle: boolean
  failingDocuments: readonly string[]
}>

export function WorkspaceBanner({
  title,
  wordCount,
  presentation,
  onPresentationChange,
  showPresentationToggle,
  failingDocuments,
}: WorkspaceBannerProps) {
  return (
    <Stack
      direction="row"
      component="footer"
      sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}
    >
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        {title !== null && <Typography variant="machine">{title}</Typography>}
        <Typography variant="machine">{wordCount} words</Typography>
        {failingDocuments.map((label) => (
          <Typography key={label} variant="machine" color="error">
            {label} is not saving
          </Typography>
        ))}
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
