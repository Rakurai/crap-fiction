import { useSyncExternalStore } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material'
import { presentValue, readState } from '../servedFacts/readState.js'
import { usePieceDetail } from '../servedFacts/resources.js'
import type { DocumentSession } from '../pieceSession/documentSession.js'
import { SURFACE_LABEL } from '../shell/state.js'

type ContextSurfaceId = 'storyContext' | 'authorContext'

export type ContextEditorProps = Readonly<{
  surface: ContextSurfaceId
  pieceId: string
  document: DocumentSession
  editable: boolean
}>

export function ContextEditor({ surface, pieceId, document, editable }: ContextEditorProps) {
  const detail = presentValue(readState(usePieceDetail(pieceId)))
  const surfaceDetail = detail?.surfaces[surface] ?? null
  const text = useSyncExternalStore(document.subscribeText, document.getText)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflowY: 'auto', p: 2, gap: 1, opacity: editable ? 1 : 0.6 }}>
      {surfaceDetail !== null && (
        <Typography variant="machine">
          {SURFACE_LABEL[surface]} — kept at {surfaceDetail.location}
        </Typography>
      )}

      <Box
        component="textarea"
        value={text}
        onChange={(event) => document.setText(event.target.value)}
        readOnly={!editable}
        sx={{
          display: 'block',
          flexGrow: 1,
          width: '100%',
          border: 'none',
          outline: 'none',
          resize: 'none',
          background: 'transparent',
          color: 'inherit',
          font: 'inherit',
          p: 0,
        }}
      />

      {surfaceDetail !== null && surfaceDetail.referenceSchema !== null && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="machine">Reference</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', font: 'inherit', m: 0 }}>
              {surfaceDetail.referenceSchema}
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}
