import { useCallback, useState } from 'react'
import type { AutosaveState, SaveDocument } from './autosave.js'
import { useAutosave, type AutosaveViewModel } from './useAutosave.js'
import { useManuscript, type ManuscriptViewModel } from './useManuscript.js'

export type DocumentSessionKind = 'prose' | 'plainText'

/**
 * A surface's document, its editor state where the body is prose, and the persistence lifecycle
 * behind it. Prose and plain text share only what `EditingSurface` itself needs from either —
 * current text, save state, and installing a replacement — which is why this is a union rather
 * than one shape wide enough to cover both bodies; everything else belongs to whichever body
 * renders it. `install` is the only path Apply may install a replacement through: it updates this
 * surface's own state and hands the exact text to the autosave controller, the surface's one
 * persistence writer, and resolves once that write has durably settled.
 */
export type DocumentSession =
  | Readonly<{ kind: 'prose'; manuscript: ManuscriptViewModel; autosave: AutosaveViewModel; text: string; install: (text: string) => Promise<AutosaveState> }>
  | Readonly<{ kind: 'plainText'; text: string; setText: (text: string) => void; autosave: AutosaveViewModel; install: (text: string) => Promise<AutosaveState> }>

function useProseSession(initialText: string, save: SaveDocument): DocumentSession {
  const manuscript = useManuscript(initialText)
  const autosave = useAutosave(manuscript.markdown, save)
  const install = useCallback(
    (text: string) => {
      manuscript.applyRecommendation(text)
      return autosave.install(text)
    },
    [manuscript.applyRecommendation, autosave.install],
  )
  return { kind: 'prose', manuscript, autosave, text: manuscript.markdown, install }
}

function usePlainTextSession(initialText: string, save: SaveDocument): DocumentSession {
  const [text, setText] = useState(initialText)
  const autosave = useAutosave(text, save)
  const install = useCallback(
    (next: string) => {
      setText(next)
      return autosave.install(next)
    },
    [autosave.install],
  )
  return { kind: 'plainText', text, setText, autosave, install }
}

/**
 * `kind` is fixed for the lifetime of the surface that calls this — a mounted surface's body
 * never switches between prose and plain text — so branching on it here is stable across that
 * surface's renders, the same as calling one hook or the other directly at each of the two call
 * sites would be.
 */
export function useDocumentSession(kind: DocumentSessionKind, initialText: string, save: SaveDocument): DocumentSession {
  if (kind === 'prose') return useProseSession(initialText, save)
  return usePlainTextSession(initialText, save)
}
