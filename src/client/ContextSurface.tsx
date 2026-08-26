import type { PieceStatus } from '../shared/pieceViews.js'
import { SURFACE_IDS, type SurfaceId } from '../shared/surfaces.js'
import styles from './ContextSurface.module.css'
import { EditableTitle } from './EditableTitle.js'
import { facts, machineWords, timeOfDay } from './facts.js'
import type { LifecycleProps } from './pieceLifecycle.js'
import { SURFACE_CONTROL_LABEL } from './surfaceLabels.js'
import type { AutosaveViewModel } from './useAutosave.js'

/** The surfaces this component draws: a plain text document beside a reference schema. */
export type ContextSurfaceId = Exclude<SurfaceId, 'draft'>

const DOCUMENT: Readonly<Record<ContextSurfaceId, { readonly label: string; readonly file: string }>> = {
  storyContext: { label: 'Story context', file: 'story-context.yaml' },
  authorContext: { label: 'Author context', file: 'author-context.yaml' },
}

type ContextSurfaceProps = {
  readonly surface: ContextSurfaceId
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
  readonly onSwitchTo: (surface: SurfaceId) => void
  readonly lifecycle: LifecycleProps
  readonly applying: { readonly participantName?: string } | undefined
}

export function ContextSurface({
  surface,
  title,
  onClose,
  text,
  onChange,
  referenceSchema,
  autosave,
  leaveBlocked,
  onOpenRoom,
  onOpenConversations,
  onSwitchTo,
  lifecycle,
  applying,
}: ContextSurfaceProps) {
  const { label, file } = DOCUMENT[surface]

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
          {SURFACE_IDS.filter((candidate) => candidate !== surface).map((candidate) => (
            <button key={candidate} type="button" className={styles.control} onClick={() => onSwitchTo(candidate)}>
              {SURFACE_CONTROL_LABEL[candidate]}
            </button>
          ))}
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
          <span className={styles.applyingBannerWords}>
            {applying.participantName === undefined ? 'Held while a change is applied.' : `Held while ${applying.participantName}'s change is applied.`}
          </span>
        </div>
      )}

      <div className={styles.scroll}>
        <div className={styles.measure}>
          <textarea
            aria-label={label}
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
            The last write to {file} failed. Nothing has been discarded — keep writing. Leaving for another piece is
            unavailable while “{title}” is unsaved.
          </p>
          <span className={styles.saveFailedCause}>{machineWords(autosave.state.message)}</span>
        </div>
      )}
    </div>
  )
}
