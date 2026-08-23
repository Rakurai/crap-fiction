import { EditorContent } from '@tiptap/react'
import { useEffect } from 'react'
import { useAutosave } from './useAutosave.js'
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

  useEffect(() => {
    if (manuscript.view !== 'reading') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') manuscript.showRendered()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [manuscript.view, manuscript.showRendered])

  return (
    <div>
      {manuscript.view !== 'reading' && (
        <div>
          <button type="button" onClick={onClose}>
            ‹ pieces
          </button>
          <span>{title}</span>
          <span>{manuscript.length} words</span>
          <button type="button" onClick={manuscript.view === 'source' ? manuscript.showRendered : manuscript.showSource}>
            {manuscript.view === 'source' ? 'rendered' : 'source'}
          </button>
          <button type="button" onClick={manuscript.showReading}>
            reading
          </button>
          {autosave.failed && <span role="status">Couldn't save — will retry</span>}
        </div>
      )}

      <div ref={manuscript.containerRef}>
        {manuscript.view === 'source' ? (
          <textarea
            aria-label="Manuscript source"
            value={manuscript.sourceText}
            onChange={(event) => manuscript.setSourceText(event.target.value)}
          />
        ) : (
          <EditorContent editor={manuscript.editor} />
        )}
      </div>

      {manuscript.view === 'reading' && (
        <div>
          <span>Esc to return</span>
          <button type="button" onClick={manuscript.showRendered}>
            back to writing
          </button>
        </div>
      )}
    </div>
  )
}
