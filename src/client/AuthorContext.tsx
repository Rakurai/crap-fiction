import type { PieceStatus } from '../shared/pieceViews.js'
import styles from './AuthorContext.module.css'
import { EditableTitle } from './EditableTitle.js'
import { facts, machineWords, timeOfDay } from './facts.js'
import type { AutosaveViewModel } from './useAutosave.js'

type LifecycleProps = {
  readonly status: PieceStatus
  readonly retitling: boolean
  readonly retitleError: string | undefined
  readonly onRetitle: (title: string) => void
  readonly settingStatus: boolean
  readonly statusError: string | undefined
  readonly onSetStatus: (status: PieceStatus) => void
}

type AuthorContextProps = {
  readonly title: string
  readonly onClose: () => void
  readonly text: string
  readonly onChange: (text: string) => void
  readonly referenceSchema: string | null
  readonly autosave: AutosaveViewModel
  /** Whether leaving the piece is refused — this document's own failed save, or another's. */
  readonly leaveBlocked: boolean
  readonly onOpenRoom: () => void
  readonly onOpenConversations: () => void
  readonly onSwitchToDraft: () => void
  readonly onSwitchToStoryContext: () => void
  readonly lifecycle: LifecycleProps
  readonly applying: { readonly participantName: string } | undefined
}

export function AuthorContext({
  title,
  onClose,
  text,
  onChange,
  referenceSchema,
  autosave,
  leaveBlocked,
  onOpenRoom,
  onOpenConversations,
  onSwitchToDraft,
  onSwitchToStoryContext,
  lifecycle,
  applying,
}: AuthorContextProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.topBar}>
        <button type="button" className={styles.leave} onClick={onClose} disabled={leaveBlocked}>
          ‹ pieces
        </button>
        <EditableTitle title={title} saving={lifecycle.retitling} onRetitle={lifecycle.onRetitle} />
        <select
          aria-label="Piece status"
          className={styles.status}
          value={lifecycle.status}
          disabled={lifecycle.settingStatus}
          onChange={(event) => lifecycle.onSetStatus(event.target.value as PieceStatus)}
        >
          <option value="drafting">drafting</option>
          <option value="finished">finished</option>
          <option value="abandoned">abandoned</option>
        </select>
        <span className={styles.spacer} />
        <div className={styles.controls}>
          <button type="button" className={styles.control} onClick={onSwitchToDraft}>
            draft
          </button>
          <button type="button" className={styles.control} onClick={onSwitchToStoryContext}>
            story context
          </button>
          <span className={styles.controlsRule} />
          <button type="button" className={styles.control} onClick={onOpenConversations}>
            conversations
          </button>
          <button type="button" className={styles.control} onClick={onOpenRoom}>
            room
          </button>
        </div>
      </div>

      {(lifecycle.retitleError ?? lifecycle.statusError) !== undefined && (
        <p className={styles.lifecycleError} role="alert">
          {lifecycle.retitleError ?? lifecycle.statusError}
        </p>
      )}

      {applying !== undefined && (
        <div className={styles.applyingBanner}>
          <span className={styles.applyingBannerFacts}>READ-ONLY</span>
          <span className={styles.applyingBannerWords}>{`Held while ${applying.participantName}'s change is applied.`}</span>
        </div>
      )}

      <div className={styles.scroll}>
        <div className={styles.measure}>
          <textarea
            aria-label="Author context"
            className={styles.text}
            value={text}
            disabled={applying !== undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>

      {referenceSchema !== null && (
        <details className={styles.reference}>
          <summary className={styles.referenceSummary}>reference schema</summary>
          <p className={styles.referenceBody}>{referenceSchema}</p>
        </details>
      )}

      {autosave.state.failed && (
        <div className={styles.saveFailed}>
          <span className={styles.saveFailedStamp}>{facts('NOT SAVED', timeOfDay(autosave.state.atMs))}</span>
          <p className={styles.saveFailedMessage} role="status">
            The last write to author-context.yaml failed. Nothing has been discarded — keep writing. Leaving for
            another piece is unavailable while “{title}” is unsaved.
          </p>
          <span className={styles.saveFailedCause}>{machineWords(autosave.state.message)}</span>
        </div>
      )}
    </div>
  )
}
