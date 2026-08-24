import { EditorContent } from '@tiptap/react'
import { useEffect, useState } from 'react'
import type { PieceStatus } from '../shared/pieceViews.js'
import { facts, machineWords, modeName, timeOfDay, wordCount } from './facts.js'
import styles from './Manuscript.module.css'
import type { AutosaveViewModel } from './useAutosave.js'
import type { ManuscriptViewModel } from './useManuscript.js'

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
  readonly onOpenRoom: () => void
  readonly onOpenConversations: () => void
  readonly onOpenCapture: () => void
  readonly lifecycle: LifecycleProps
  readonly applying: boolean
}

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

export function Manuscript({ title, mode, onClose, manuscript, autosave, onOpenRoom, onOpenConversations, onOpenCapture, lifecycle, applying }: ManuscriptProps) {
  const reading = manuscript.view === 'reading'

  useEffect(() => {
    if (manuscript.view !== 'reading') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') manuscript.showRendered()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [manuscript.view, manuscript.showRendered])

  useEffect(() => {
    manuscript.editor?.setEditable(!reading && !applying)
  }, [manuscript.editor, reading, applying])

  return (
    <div className={styles.wrapper}>
      {!reading && (
        <div className={styles.topBar}>
          <button type="button" className={styles.control} onClick={onClose} disabled={autosave.state.failed}>
            ‹ pieces
          </button>
          <EditableTitle title={title} saving={lifecycle.retitling} onRetitle={lifecycle.onRetitle} />
          <span className={styles.length}>{facts(modeName(mode), wordCount(manuscript.length))}</span>
          {applying && <span className={styles.applying}>READ-ONLY</span>}
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
            <button type="button" className={styles.control} onClick={onOpenConversations}>
              conversations
            </button>
            <button type="button" className={styles.control} onClick={onOpenRoom}>
              room
            </button>
            <button type="button" className={styles.control} onClick={onOpenCapture}>
              capture context
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
              disabled={applying}
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
