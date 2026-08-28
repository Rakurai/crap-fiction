import { SURFACE_IDS, type SurfaceId } from '../shared/surfaces.js'
import styles from './DocumentHeader.module.css'
import { EditableTitle } from './EditableTitle.js'
import type { LifecycleProps } from './pieceLifecycle.js'
import { SURFACE_CONTROL_LABEL } from './surfaceLabels.js'
import { usePaneWidth } from './usePaneWidth.js'

const SHORT_LABEL_THRESHOLD = 640

const VIEW_IDS = ['source', 'rendered'] as const

type ViewId = (typeof VIEW_IDS)[number]

const SHORT_VIEW_LABEL: Readonly<Record<ViewId, string>> = {
  source: 'src',
  rendered: 'prose',
}

export type DraftControls = Readonly<{
  view: ViewId
  onShowView: (view: ViewId) => void
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
  const shortLabels = paneWidth < SHORT_LABEL_THRESHOLD

  return (
    <div ref={paneRef} className={styles.bar}>
      <div className={styles.doors}>
        <button type="button" className={styles.door} onClick={onOpenPieces}>
          PIECES
        </button>
        <button type="button" className={styles.door} onClick={onOpenModels}>
          MODELS
        </button>
      </div>
      <span className={styles.rule} />
      <EditableTitle title={title} saving={lifecycle.retitling} onRetitle={lifecycle.onRetitle} />
      {length !== undefined && <span className={styles.length}>{length}</span>}
      <span className={styles.spacer} />
      <div className={styles.controls}>
        {draftControls !== undefined && (
          <>
            <div className={styles.switcher}>
              {VIEW_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.switcherOption}
                  aria-current={id === draftControls.view}
                  onClick={() => draftControls.onShowView(id)}
                >
                  {shortLabels ? SHORT_VIEW_LABEL[id] : id}
                </button>
              ))}
            </div>
            <button type="button" className={styles.viewControl} onClick={draftControls.onReading}>
              {shortLabels ? 'read' : 'reading'}
            </button>
            <span className={styles.rule} />
          </>
        )}
        <div className={styles.switcher}>
          {SURFACE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.switcherOption}
              aria-current={id === surface}
              onClick={() => onSwitchTo(id)}
            >
              {SURFACE_CONTROL_LABEL[id]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
