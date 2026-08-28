import { EditorContent } from '@tiptap/react'
import { useEffect, useState } from 'react'
import type { SurfaceId } from '../shared/surfaces.js'
import { ApplyingBanner } from './ApplyingBanner.js'
import { DocumentHeader } from './DocumentHeader.js'
import { facts, machineWords, modeName, wordCount } from './facts.js'
import styles from './Manuscript.module.css'
import type { LifecycleProps } from './pieceLifecycle.js'
import { SaveFailure } from './SaveFailure.js'
import type { ApplyingHold } from './useConversationSession.js'
import type { AutosaveViewModel } from './useAutosave.js'
import type { ManuscriptViewModel } from './useManuscript.js'
import { usePaneWidth } from './usePaneWidth.js'

type ManuscriptProps = {
  readonly title: string
  readonly mode: string
  readonly namesMode: boolean
  readonly onOpenPieces: () => void
  readonly onOpenModels: () => void
  readonly manuscript: ManuscriptViewModel
  readonly location: string
  readonly autosave: AutosaveViewModel
  readonly onSwitchTo: (surface: SurfaceId) => void
  readonly lifecycle: LifecycleProps
  readonly applying: ApplyingHold | undefined
}

export function Manuscript({
  title,
  mode,
  namesMode,
  onOpenPieces,
  onOpenModels,
  manuscript,
  location,
  autosave,
  onSwitchTo,
  lifecycle,
  applying,
}: ManuscriptProps) {
  const reading = manuscript.view === 'reading'
  const [measureRef, measureWidth] = usePaneWidth<HTMLDivElement>()
  const [measureBesideConversation, setMeasureBesideConversation] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!reading && Number.isFinite(measureWidth)) setMeasureBesideConversation(measureWidth)
  }, [reading, measureWidth])

  useEffect(() => {
    if (manuscript.view !== 'reading') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') manuscript.leaveReading()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [manuscript.view, manuscript.leaveReading])

  useEffect(() => {
    manuscript.editor?.setEditable(!reading && applying === undefined)
  }, [manuscript.editor, reading, applying])

  return (
    <div className={styles.wrapper}>
      {!reading && (
        <DocumentHeader
          onOpenPieces={onOpenPieces}
          onOpenModels={onOpenModels}
          title={title}
          lifecycle={lifecycle}
          length={namesMode ? facts(modeName(mode), wordCount(manuscript.length)) : wordCount(manuscript.length)}
          surface="draft"
          onSwitchTo={onSwitchTo}
          draftControls={{
            view: manuscript.view === 'source' ? 'source' : 'rendered',
            onShowView: (view) => (view === 'source' ? manuscript.showSource() : manuscript.showRendered()),
            onReading: manuscript.showReading,
          }}
        />
      )}

      {!reading && lifecycle.retitleError !== undefined && (
        <p className={styles.lifecycleError} role="alert">
          {lifecycle.retitleError}
        </p>
      )}

      {applying !== undefined && <ApplyingBanner applying={applying} />}

      <div
        ref={manuscript.containerRef}
        className={reading ? `${styles.scroll} ${styles.readingScroll}` : styles.scroll}
      >
        <div
          ref={measureRef}
          className={styles.measure}
          style={reading && measureBesideConversation !== undefined ? { maxWidth: measureBesideConversation } : undefined}
        >
          {reading && <h1 className={styles.readingTitle}>{title}</h1>}
          {manuscript.view === 'source' ? (
            <textarea
              aria-label="Manuscript source"
              className={styles.source}
              value={manuscript.sourceText}
              disabled={applying !== undefined}
              onChange={(event) => manuscript.setSourceText(event.target.value)}
            />
          ) : (
            <div className={styles.editor}>
              <EditorContent editor={manuscript.editor} />
            </div>
          )}
        </div>
      </div>

      {reading && (
        <button type="button" className={styles.wayBack} onClick={manuscript.leaveReading}>
          {facts(machineWords('esc'), machineWords('return'))}
        </button>
      )}

      {!reading && autosave.state.failed && <SaveFailure failure={autosave.state} location={location} title={title} />}
    </div>
  )
}
