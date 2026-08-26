import { useState } from 'react'
import type { SaveDocument } from './autosave.js'
import { useAutosave, type AutosaveViewModel } from './useAutosave.js'
import { useManuscript, type ManuscriptViewModel } from './useManuscript.js'

export type DocumentSessionKind = 'prose' | 'plainText'

/**
 * A surface's document, its editor state where the body is prose, and the persistence lifecycle
 * behind it. Prose and plain text share only what `EditingSurface` itself needs from either —
 * current text and save state — which is why this is a union rather than one shape wide enough
 * to cover both bodies; everything else belongs to whichever body renders it.
 */
export type DocumentSession =
  | Readonly<{ kind: 'prose'; manuscript: ManuscriptViewModel; autosave: AutosaveViewModel; text: string }>
  | Readonly<{ kind: 'plainText'; text: string; setText: (text: string) => void; autosave: AutosaveViewModel }>

function useProseSession(initialText: string, save: SaveDocument): DocumentSession {
  const manuscript = useManuscript(initialText)
  const autosave = useAutosave(manuscript.markdown, save)
  return { kind: 'prose', manuscript, autosave, text: manuscript.markdown }
}

function usePlainTextSession(initialText: string, save: SaveDocument): DocumentSession {
  const [text, setText] = useState(initialText)
  const autosave = useAutosave(text, save)
  return { kind: 'plainText', text, setText, autosave }
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
