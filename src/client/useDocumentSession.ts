import { useCallback, useState } from 'react'
import type { AutosaveState, SaveDocument } from './autosave.js'
import { useAutosave, type AutosaveViewModel } from './useAutosave.js'
import { useManuscript, type ManuscriptViewModel } from './useManuscript.js'

/**
 * What an editing surface needs from its document whichever body renders it: the current text, the
 * state of its persistence, and installing a replacement. `install` is the only path Apply may
 * install through — it updates the surface's own state and hands the exact text to the autosave
 * controller, the surface's one persistence writer, resolving once that write has durably settled.
 */
type PersistedDocument = Readonly<{
  text: string
  autosave: AutosaveViewModel
  install: (text: string) => Promise<AutosaveState>
}>

export type ProseSession = PersistedDocument & Readonly<{ manuscript: ManuscriptViewModel }>

export type PlainTextSession = PersistedDocument & Readonly<{ setText: (text: string) => void }>

export function useProseSession(initialText: string, save: SaveDocument): ProseSession {
  const manuscript = useManuscript(initialText)
  const autosave = useAutosave(manuscript.markdown, save)
  const install = useCallback(
    (text: string) => {
      manuscript.applyRecommendation(text)
      return autosave.install(text)
    },
    [manuscript.applyRecommendation, autosave.install],
  )
  return { manuscript, autosave, text: manuscript.markdown, install }
}

export function usePlainTextSession(initialText: string, save: SaveDocument): PlainTextSession {
  const [text, setText] = useState(initialText)
  const autosave = useAutosave(text, save)
  const install = useCallback(
    (next: string) => {
      setText(next)
      return autosave.install(next)
    },
    [autosave.install],
  )
  return { text, setText, autosave, install }
}
