import { SURFACE_IDS, type SurfaceId } from '../shared/surfaces.js'
import styles from './DocumentHeader.module.css'
import { EditableTitle } from './EditableTitle.js'
import type { LifecycleProps } from './pieceLifecycle.js'
import { SURFACE_CONTROL_LABEL } from './surfaceLabels.js'
import { usePaneWidth } from './usePaneWidth.js'

const LENGTH_THRESHOLD = 760
const MODELS_THRESHOLD = 600
const SHORT_LABEL_THRESHOLD = 640

const SHORT_VIEW_LABEL: Readonly<Record<'source' | 'rendered', string>> = {
  source: 'src',
  rendered: 'prose',
}

export type DraftControls = Readonly<{
  viewLabel: 'source' | 'rendered'
  onToggleView: () => void
  onReading: () => void
}>

type DocumentHeaderProps = {
  readonly onOpenPieces: () => void
  readonly onOpenModels: () => void
  readonly title: string
  readonly lifecycle: LifecycleProps
  readonly length?: string
  readonly surface: SurfaceId
  readonly onSwitchTo: (surface: SurfaceId) => void
  readonly draftControls?: DraftControls
}

export function DocumentHeader({ onOpenPieces, onOpenModels, title, lifecycle, length, surface, onSwitchTo, draftControls }: DocumentHeaderProps) {
  const [paneRef, paneWidth] = usePaneWidth<HTMLDivElement>()
  const showLength = length !== undefined && paneWidth >= LENGTH_THRESHOLD
  const showModels = paneWidth >= MODELS_THRESHOLD
  const shortLabels = paneWidth < SHORT_LABEL_THRESHOLD

  return (
    <div ref={paneRef} className={styles.bar}>
      <div className={styles.doors}>
        <button type="button" className={styles.door} onClick={onOpenPieces}>
          PIECES
        </button>
        {showModels && (
          <button type="button" className={styles.door} onClick={onOpenModels}>
            MODELS
          </button>
        )}
      </div>
      <span className={styles.rule} />
      <EditableTitle title={title} saving={lifecycle.retitling} onRetitle={lifecycle.onRetitle} />
      {showLength && <span className={styles.length}>{length}</span>}
      <span className={styles.spacer} />
      <div className={styles.controls}>
        <div className={styles.switcher}>
          {SURFACE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={id === surface ? `${styles.switcherOption} ${styles.switcherOptionActive}` : styles.switcherOption}
              onClick={() => onSwitchTo(id)}
            >
              {SURFACE_CONTROL_LABEL[id]}
            </button>
          ))}
        </div>
        {draftControls !== undefined && (
          <>
            <span className={styles.rule} />
            <button type="button" className={styles.viewControl} onClick={draftControls.onToggleView}>
              {shortLabels ? SHORT_VIEW_LABEL[draftControls.viewLabel] : draftControls.viewLabel}
            </button>
            <button type="button" className={styles.viewControl} onClick={draftControls.onReading}>
              {shortLabels ? 'read' : 'reading'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
