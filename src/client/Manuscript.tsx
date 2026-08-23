import { EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import { useAutosave } from './useAutosave.js'
import styles from './Manuscript.module.css'
import { useManuscript } from './useManuscript.js'

type ManuscriptProps = {
  readonly pieceId: string
  readonly title: string
  readonly draft: string
  readonly onClose: () => void
}

/**
 * SPEC "The prose surface": three ways to see the manuscript, switched in
 * one action, with position intact. Rendered and reading share one editor
 * instance and one scroll container — kept mounted across that switch
 * rather than rebuilt, which is what keeps position intact for free. The
 * source view is a different representation entirely (raw Markdown text
 * rather than rendered prose), so an exact cursor mapping between the two
 * is not well-defined; the scroll ratio — where the author is looking — is
 * preserved across that switch instead.
 */
export function Manuscript({ pieceId, title, draft, onClose }: ManuscriptProps) {
  const manuscript = useManuscript(draft)
  const autosave = useAutosave(pieceId, manuscript.markdown)
  const reading = manuscript.view === 'reading'

  useEffect(() => {
    if (manuscript.view !== 'reading') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') manuscript.showRendered()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [manuscript.view, manuscript.showRendered])

  return (
    <div className={styles.wrapper}>
      {!reading && (
        <div className={styles.topBar}>
          <button type="button" className={styles.control} onClick={onClose}>
            ‹ pieces
          </button>
          <span className={styles.title}>{title}</span>
          <span className={styles.length}>{manuscript.length} words</span>
          <span className={styles.spacer} />
          <div className={styles.controls}>
            <button type="button" className={styles.control} onClick={manuscript.view === 'source' ? manuscript.showRendered : manuscript.showSource}>
              {manuscript.view === 'source' ? 'rendered' : 'source'}
            </button>
            <button type="button" className={styles.control} onClick={manuscript.showReading}>
              reading
            </button>
          </div>
        </div>
      )}

      <div ref={manuscript.containerRef} className={reading ? styles.readingScroll : styles.scroll}>
        <div className={reading ? styles.readingMeasure : styles.measure}>
          {reading && <h1 className={styles.readingTitle}>{title}</h1>}
          {manuscript.view === 'source' ? (
            <textarea
              aria-label="Manuscript source"
              className={styles.source}
              value={manuscript.sourceText}
              onChange={(event) => manuscript.setSourceText(event.target.value)}
            />
          ) : (
            <div className={reading ? styles.readingEditor : styles.editor}>
              <EditorContent editor={manuscript.editor} />
            </div>
          )}
        </div>
      </div>

      {!reading && autosave.failed && (
        <div className={styles.saveFailed}>
          <span className={styles.saveFailedFacts}>NOT SAVED</span>
          <p className={styles.saveFailedMessage} role="status">
            Couldn't save — {autosave.message} — will retry
          </p>
        </div>
      )}

      {reading && (
        <div className={styles.readingFooter}>
          <span className={styles.readingHint}>ESC TO RETURN</span>
          <button type="button" className={styles.readingBack} onClick={manuscript.showRendered}>
            back to writing
          </button>
        </div>
      )}
    </div>
  )
}
