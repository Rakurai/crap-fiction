import { EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import { Conversation } from './Conversation.js'
import { facts, machineWords, modeName, timeOfDay, wordCount } from './facts.js'
import { useAutosave } from './useAutosave.js'
import styles from './Manuscript.module.css'
import { useManuscript } from './useManuscript.js'
import type { RoundSnapshot } from '../shared/roundEvents.js'

type ManuscriptProps = {
  readonly pieceId: string
  readonly title: string
  readonly mode: string
  readonly draft: string
  readonly currentConversationId: string | null
  readonly roundInFlight: RoundSnapshot | null
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
 *
 * UX_DESIGN "A failed save": leaving is free everywhere else because everything
 * written is already on disk, and while a save is failing it is refused rather
 * than confirmed — an author asked whether to discard their own prose has been
 * asked the wrong question. The notice is the one place that says why, so the
 * disabled control carries no second explanation of its own. The manuscript
 * stays editable throughout, and the next write that succeeds clears both.
 */
export function Manuscript({ pieceId, title, mode, draft, currentConversationId, roundInFlight, onClose }: ManuscriptProps) {
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
    <div className={styles.row}>
      <div className={styles.wrapper}>
        {!reading && (
          <div className={styles.topBar}>
            <button type="button" className={styles.control} onClick={onClose} disabled={autosave.failed}>
              ‹ pieces
            </button>
            <span className={styles.title}>{title}</span>
            <span className={styles.length}>{facts(modeName(mode), wordCount(manuscript.length))}</span>
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
            {reading && <p className={styles.readingHint}>ESC TO RETURN</p>}
          </div>
        </div>

        {!reading && autosave.failed && autosave.failedAtMs !== undefined && (
          <div className={styles.saveFailed}>
            <span className={styles.saveFailedStamp}>{facts('NOT SAVED', timeOfDay(autosave.failedAtMs))}</span>
            <p className={styles.saveFailedMessage} role="status">
              The last write to draft.md failed. Nothing has been discarded — keep writing. Leaving for another piece is
              unavailable while “{title}” is unsaved.
            </p>
            {autosave.message !== undefined && <span className={styles.saveFailedCause}>{machineWords(autosave.message)}</span>}
          </div>
        )}
      </div>

      {!reading && (
        <Conversation
          pieceId={pieceId}
          currentConversationId={currentConversationId}
          roundInFlight={roundInFlight}
          draft={manuscript.markdown}
          flushDraft={autosave.flush}
        />
      )}
    </div>
  )
}
