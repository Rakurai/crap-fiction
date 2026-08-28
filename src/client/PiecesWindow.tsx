import { NewPieceForm, offeredModes } from './NewPieceForm.js'
import { PanelHeader } from './PanelHeader.js'
import { PieceList } from './PieceList.js'
import styles from './PiecesWindow.module.css'
import { Scrim } from './Scrim.js'
import type { PiecesViewModel } from './usePieces.js'

type PiecesWindowProps = {
  readonly workspace: string
  readonly pieces: PiecesViewModel
  readonly openedId: string | undefined
  readonly leaveBlocked: boolean
  readonly onOpen: (id: string) => void
  readonly onClose: () => void
}

export function PiecesWindow({ workspace, pieces, openedId, leaveBlocked, onOpen, onClose }: PiecesWindowProps) {
  const modes = pieces.status === 'ready' ? offeredModes(pieces.modes) : undefined

  return (
    <>
      <Scrim onDismiss={onClose} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Pieces">
        <PanelHeader title="crap fiction" tone="wordmark" onDismiss={onClose} />
        <p className={styles.what}>A studio for writing fiction with a room of specialized collaborators.</p>
        {pieces.status === 'ready' && <PieceList pieces={pieces.pieces} openedId={openedId} leaveBlocked={leaveBlocked} onOpen={onOpen} />}
        {pieces.status === 'error' && (
          <p className={styles.error} role="alert">
            {pieces.message}
          </p>
        )}
        {pieces.status === 'ready' && modes !== undefined && (
          <div className={styles.creating}>
            <NewPieceForm submitting={pieces.creating} error={pieces.createError} modes={modes} onSubmit={pieces.create} />
          </div>
        )}
        <p className={styles.workspace} title={workspace}>
          {workspace}
        </p>
      </div>
    </>
  )
}
