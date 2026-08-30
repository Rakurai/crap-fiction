import { Typography } from '@mui/material'
import type { SurfaceId } from '../../shared/surfaces.js'
import { useWordCount } from '../pieceSession/PieceSessionProvider.js'

export type WordCountProps = Readonly<{ surface: SurfaceId }>

export function WordCount({ surface }: WordCountProps) {
  return <Typography variant="machine">{useWordCount(surface)} words</Typography>
}
