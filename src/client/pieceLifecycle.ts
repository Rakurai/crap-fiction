import type { PieceStatus } from '../shared/pieceViews.js'

/** The piece-wide retitle and status controls every surface's chrome draws identically. */
export type LifecycleProps = Readonly<{
  status: PieceStatus
  retitling: boolean
  retitleError: string | undefined
  onRetitle: (title: string) => void
  settingStatus: boolean
  statusError: string | undefined
  onSetStatus: (status: PieceStatus) => void
}>
