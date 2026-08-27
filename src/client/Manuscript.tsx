import { EditorContent } from '@tiptap/react'
import { useEffect, useState } from 'react'
import type { SurfaceId } from '../shared/surfaces.js'
import { DocumentHeader } from './DocumentHeader.js'
import { facts, machineWords, modeName, timeOfDay, wordCount } from './facts.js'
import styles from './Manuscript.module.css'
import type { LifecycleProps } from './pieceLifecycle.js'
import type { ApplyingHold } from './useConversationSession.js'
import type { AutosaveViewModel } from './useAutosave.js'
import type { ManuscriptViewModel } from './useManuscript.js'
import { usePaneWidth } from './usePaneWidth.js'

type ManuscriptProps = {
  readonly title: string
  readonly mode: string
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
  const [paneRef, paneWidth] = usePaneWidth<HTMLDivElement>()
  const [widthBesideConversation, setWidthBesideConversation] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!reading && Number.isFinite(paneWidth)) setWidthBesideConversation(paneWidth)
  }, [reading, paneWidth])

  useEffect(() => {
    if (manuscript.view !== 'reading') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') manuscript.showRendered()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [manuscript.view, manuscript.showRendered])

  useEffect(() => {
    manuscript.editor?.setEditable(!reading && applying === undefined)
  }, [manuscript.editor, reading, applying])

  return (
    <div ref={paneRef} className={styles.wrapper}>
      {!reading && (
        <DocumentHeader
          onOpenPieces={onOpenPieces}
          onOpenModels={onOpenModels}
          title={title}
          lifecycle={lifecycle}
          length={facts(modeName(mode), wordCount(manuscript.length))}
          surface="draft"
          onSwitchTo={onSwitchTo}
          draftControls={{
            viewLabel: manuscript.view === 'source' ? 'rendered' : 'source',
            onToggleView: manuscript.view === 'source' ? manuscript.showRendered : manuscript.showSource,
            onReading: manuscript.showReading,
          }}
        />
      )}

      {!reading && lifecycle.retitleError !== undefined && (
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

      <div
        ref={manuscript.containerRef}
        className={reading ? `${styles.scroll} ${styles.readingScroll}` : styles.scroll}
        style={reading && widthBesideConversation !== undefined ? { maxWidth: widthBesideConversation } : undefined}
      >
        <div className={styles.measure}>
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

      {reading && <div className={styles.wayBack}>{facts(machineWords('esc'), machineWords('return'))}</div>}

      {!reading && autosave.state.failed && (
        <div className={styles.saveFailed}>
          <span className={styles.saveFailedStamp}>{facts('NOT SAVED', timeOfDay(autosave.state.atMs))}</span>
          <p className={styles.saveFailedMessage} role="status">
            The last write to {location} failed. Nothing has been discarded — keep writing. Leaving for another piece is
            unavailable while “{title}” is unsaved.
          </p>
          <span className={styles.saveFailedCause}>{machineWords(autosave.state.message)}</span>
        </div>
      )}
    </div>
  )
}
