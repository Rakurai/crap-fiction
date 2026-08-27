import { useCallback, useState } from 'react'
import type { AutosaveState, SaveDocument } from './autosave.js'
import { useAutosave, type AutosaveViewModel } from './useAutosave.js'
import { useManuscript, type ManuscriptViewModel } from './useManuscript.js'

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
    async (text: string) => {
      const restore = manuscript.applyRecommendation(text)
      const result = await autosave.install(text)
      if (result.failed) restore()
      return result
    },
    [manuscript.applyRecommendation, autosave.install],
  )
  return { manuscript, autosave, text: manuscript.markdown, install }
}

export function usePlainTextSession(initialText: string, save: SaveDocument): PlainTextSession {
  const [text, setText] = useState(initialText)
  const autosave = useAutosave(text, save)
  const install = useCallback(
    async (next: string) => {
      const previous = text
      setText(next)
      const result = await autosave.install(next)
      if (result.failed) setText(previous)
      return result
    },
    [text, autosave.install],
  )
  return { text, setText, autosave, install }
}
