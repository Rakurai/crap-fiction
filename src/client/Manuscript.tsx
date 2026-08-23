import { EditorContent } from '@tiptap/react'
import { useEffect, useState } from 'react'
import type { PieceStatus } from '../shared/pieceViews.js'
import { facts, machineWords, modeName, timeOfDay, wordCount } from './facts.js'
import styles from './Manuscript.module.css'
import type { AutosaveViewModel } from './useAutosave.js'
import type { ManuscriptViewModel } from './useManuscript.js'

/** #19 "Piece lifecycle": retitling and marking a piece finished or abandoned, bundled the way `OpenedPiece` composes it. */
type LifecycleProps = {
  readonly status: PieceStatus
  readonly retitling: boolean
  readonly retitleError: string | undefined
  readonly onRetitle: (title: string) => void
  readonly settingStatus: boolean
  readonly statusError: string | undefined
  readonly onSetStatus: (status: PieceStatus) => void
}

type ManuscriptProps = {
  readonly title: string
  readonly mode: string
  readonly onClose: () => void
  readonly manuscript: ManuscriptViewModel
  readonly autosave: AutosaveViewModel
  /** UX_DESIGN "Prominence": editing the room is one action away, reached from here like the other view controls — this surface knows nothing else about it. */
  readonly onOpenRoom: () => void
  readonly lifecycle: LifecycleProps
}

/**
 * #19 "Piece lifecycle": the title in place, reached and left in one action
 * each way — the same reveal-on-click, escape-to-withdraw shape
 * `NewPieceForm` uses for naming a piece the first time. Retitling never
 * renames the piece's directory, so nothing here needs to know it has one.
 */
function EditableTitle({ title, saving, onRetitle }: { readonly title: string; readonly saving: boolean; readonly onRetitle: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)

  if (!editing) {
    return (
      <button type="button" className={styles.title} onClick={() => { setDraft(title); setEditing(true) }}>
        {title}
      </button>
    )
  }

  return (
    <form
      className={styles.retitleForm}
      onSubmit={(event) => {
        event.preventDefault()
        const next = draft.trim()
        setEditing(false)
        if (next.length > 0 && next !== title) onRetitle(next)
      }}
    >
      <input
        aria-label="Piece title"
        className={styles.retitleInput}
        value={draft}
        autoFocus
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false)
        }}
      />
      <button type="submit" className={styles.retitleSave} disabled={saving}>
        save
      </button>
    </form>
  )
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
 * This is the prose surface and nothing else. The manuscript's text and its
 * autosave are handed in rather than owned here, because the conversation beside
 * it needs both — and while this surface owned them, it also had to carry the
 * conversation's adapters through, which made the prose surface the place the
 * room's collaborators were wired. `OpenedPiece` is that place now.
 *
 * UX_DESIGN "A failed save": leaving is free everywhere else because everything
 * written is already on disk, and while a save is failing it is refused rather
 * than confirmed — an author asked whether to discard their own prose has been
 * asked the wrong question. The notice is the one place that says why, so the
 * disabled control carries no second explanation of its own. The manuscript
 * stays editable throughout, and the next write that succeeds clears both.
 */
export function Manuscript({ title, mode, onClose, manuscript, autosave, onOpenRoom, lifecycle }: ManuscriptProps) {
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
          <button type="button" className={styles.control} onClick={onClose} disabled={autosave.state.failed}>
            ‹ pieces
          </button>
          <EditableTitle title={title} saving={lifecycle.retitling} onRetitle={lifecycle.onRetitle} />
          <span className={styles.length}>{facts(modeName(mode), wordCount(manuscript.length))}</span>
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
            <button type="button" className={styles.control} onClick={manuscript.view === 'source' ? manuscript.showRendered : manuscript.showSource}>
              {manuscript.view === 'source' ? 'rendered' : 'source'}
            </button>
            <button type="button" className={styles.control} onClick={manuscript.showReading}>
              reading
            </button>
            <button type="button" className={styles.control} onClick={onOpenRoom}>
              room
            </button>
          </div>
        </div>
      )}

      {!reading && (lifecycle.retitleError ?? lifecycle.statusError) !== undefined && (
        <p className={styles.lifecycleError} role="alert">
          {lifecycle.retitleError ?? lifecycle.statusError}
        </p>
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

      {!reading && autosave.state.failed && (
        <div className={styles.saveFailed}>
          <span className={styles.saveFailedStamp}>{facts('NOT SAVED', timeOfDay(autosave.state.atMs))}</span>
          <p className={styles.saveFailedMessage} role="status">
            The last write to draft.md failed. Nothing has been discarded — keep writing. Leaving for another piece is
            unavailable while “{title}” is unsaved.
          </p>
          <span className={styles.saveFailedCause}>{machineWords(autosave.state.message)}</span>
        </div>
      )}
    </div>
  )
}
