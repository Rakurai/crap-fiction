import { EditorContent } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
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
  readonly lifecycle: LifecycleProps
  readonly applying: { readonly participantName: string } | undefined
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

/** How long the way out of the reading view stands after the author last moved the pointer. */
const WAY_BACK_HOLDS_MS = 2400

export function Manuscript({ title, mode, onClose, manuscript, autosave, onOpenRoom, onOpenConversations, lifecycle, applying }: ManuscriptProps) {
  const reading = manuscript.view === 'reading'
  const [wayBackRevealed, setWayBackRevealed] = useState(false)
  const wayBackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // The reading view holds no chrome at rest. Moving the pointer is what asks for the way out,
  // which is what a long piece entered near the top needs and a short one never has to see.
  function revealTheWayBack(): void {
    setWayBackRevealed(true)
    if (wayBackTimer.current !== undefined) clearTimeout(wayBackTimer.current)
    wayBackTimer.current = setTimeout(() => setWayBackRevealed(false), WAY_BACK_HOLDS_MS)
  }

  useEffect(() => {
    setWayBackRevealed(false)
    return () => {
      if (wayBackTimer.current !== undefined) clearTimeout(wayBackTimer.current)
    }
  }, [manuscript.view])

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
    <div className={reading ? `${styles.wrapper} ${styles.wrapperReading}` : styles.wrapper}>
      {!reading && (
        <div className={styles.topBar}>
          <button type="button" className={styles.leave} onClick={onClose} disabled={autosave.state.failed}>
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
            <button type="button" className={styles.viewControl} onClick={manuscript.view === 'source' ? manuscript.showRendered : manuscript.showSource}>
              {manuscript.view === 'source' ? 'rendered' : 'source'}
            </button>
            <button type="button" className={styles.viewControl} onClick={manuscript.showReading}>
              reading
            </button>
            <span className={styles.controlsRule} />
            <button type="button" className={styles.control} onClick={onOpenConversations}>
              conversations
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

      {!reading && applying !== undefined && (
        <div className={styles.applyingBanner}>
          <span className={styles.applyingBannerFacts}>READ-ONLY</span>
          <span className={styles.applyingBannerWords}>{`Held while ${applying.participantName}'s change is applied.`}</span>
        </div>
      )}

      <div
        ref={manuscript.containerRef}
        className={reading ? `${styles.scroll} ${styles.readingScroll}` : styles.scroll}
        onPointerMove={reading ? revealTheWayBack : undefined}
      >
        <div className={styles.measure}>
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

      {reading && wayBackRevealed && (
        <button type="button" className={styles.wayBack} onClick={manuscript.showRendered}>
          {facts(machineWords('esc'), machineWords('return'))}
        </button>
      )}

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
