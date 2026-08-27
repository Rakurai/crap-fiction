import { type SurfaceId } from '../shared/surfaces.js'
import styles from './ContextSurface.module.css'
import { DocumentHeader } from './DocumentHeader.js'
import { facts, machineWords, timeOfDay } from './facts.js'
import type { LifecycleProps } from './pieceLifecycle.js'
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
  readonly onOpenPieces: () => void
  readonly onOpenModels: () => void
  readonly text: string
  readonly onChange: (text: string) => void
  readonly referenceSchema: string | null
  readonly autosave: AutosaveViewModel
  readonly onSwitchTo: (surface: SurfaceId) => void
  readonly lifecycle: LifecycleProps
  readonly applying: { readonly participantName?: string; readonly abandon: () => void } | undefined
}

export function ContextSurface({
  surface,
  title,
  onOpenPieces,
  onOpenModels,
  text,
  onChange,
  referenceSchema,
  autosave,
  onSwitchTo,
  lifecycle,
  applying,
}: ContextSurfaceProps) {
  const { label, file } = DOCUMENT[surface]

  return (
    <div className={styles.wrapper}>
      <DocumentHeader
        onOpenPieces={onOpenPieces}
        onOpenModels={onOpenModels}
        title={title}
        lifecycle={lifecycle}
        surface={surface}
        onSwitchTo={onSwitchTo}
      />

      {lifecycle.retitleError !== undefined && (
        <p className={styles.lifecycleError} role="alert">
          {lifecycle.retitleError}
        </p>
      )}

      {applying !== undefined && (
        <div className={styles.applyingBanner}>
          <span className={styles.applyingBannerFacts}>READ-ONLY</span>
          <span className={styles.applyingBannerWords}>
            {applying.participantName === undefined ? 'Held while a change is applied.' : `Held while ${applying.participantName}'s change is applied.`}
          </span>
          <button type="button" className={styles.applyingBannerAbandon} onClick={applying.abandon}>
            abandon
          </button>
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
