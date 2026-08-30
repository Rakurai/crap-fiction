import { Typography } from '@mui/material'
import { useFailingSurfaceIds } from '../pieceSession/PieceSessionProvider.js'
import { SURFACE_LABEL } from './state.js'

export function FailingDocuments() {
  const failing = useFailingSurfaceIds()

  return (
    <>
      {failing.map((surface) => (
        <Typography key={surface} variant="machine" color="error">
          {SURFACE_LABEL[surface]} is not saving
        </Typography>
      ))}
    </>
  )
}
