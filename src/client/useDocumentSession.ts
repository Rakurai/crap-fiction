import { useCallback, useRef, useState } from 'react'
import type { AutosaveState, SaveDocument } from './autosave.js'
import { useAutosave, type AutosaveViewModel } from './useAutosave.js'
import { useManuscript, type ManuscriptViewModel } from './useManuscript.js'

type PersistedDocument = Readonly<{
  text: string
  autosave: AutosaveViewModel
  install: (text: string) => Promise<AutosaveState>
}>

export type ProseSession = PersistedDocument & Readonly<{ manuscript: ManuscriptViewModel }>

export type PlainTextSession = PersistedDocument & Readonly<{ setText: (text: string) => void; reverseApplication: () => boolean }>

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
  const reversal = useRef<string | null>(null)

  const changeText = useCallback((next: string) => {
    reversal.current = null
    setText(next)
  }, [])

  const install = useCallback(
    async (next: string) => {
      const previous = text
      setText(next)
      const result = await autosave.install(next)
      if (result.failed) setText(previous)
      else reversal.current = previous
      return result
    },
    [text, autosave.install],
  )

  const reverseApplication = useCallback(() => {
    const previous = reversal.current
    if (previous === null) return false
    reversal.current = null
    setText(previous)
    return true
  }, [])

  return { text, setText: changeText, autosave, install, reverseApplication }
}
