import { NewPieceForm, offeredModes } from './NewPieceForm.js'
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
        <div className={styles.header}>
          <span className={styles.name}>crap fiction</span>
          <button type="button" className={styles.done} onClick={onClose}>
            close
          </button>
        </div>
        <p className={styles.what}>A studio for writing fiction with a room of specialized collaborators.</p>
        {pieces.status === 'ready' && <PieceList pieces={pieces.pieces} openedId={openedId} leaveBlocked={leaveBlocked} onOpen={onOpen} />}
        {pieces.status === 'error' && (
          <p className={styles.error} role="alert">
            {pieces.message}
          </p>
        )}
        {/* A listing that failed carries no mode to create in, and a create control that cannot
            create is worse than an absent one, so the form is absent until there is one. */}
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
