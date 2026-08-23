import { useCallback, useEffect, useState } from 'react'
import type { Theme } from '../server/interfaceTheme.js'
import { chooseTheme, fetchTheme } from './themeClient.js'

export type ThemeViewModel = {
  /** `undefined` while loading, `null` when the author has not chosen. */
  readonly theme: Theme | null | undefined
  readonly choose: (theme: Theme) => void
}

/**
 * SPEC "Files": the theme lives in settings.yaml, and absence means the
 * author has not chosen — so nothing here writes a value the author did not
 * pick. Applying the choice is a `data-theme` attribute; with no theme
 * chosen the attribute is left off entirely, which is what leaves the
 * interface following the operating system.
 */
export function useTheme(): ThemeViewModel {
  const [theme, setTheme] = useState<Theme | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetchTheme().then((value) => {
      if (!cancelled) setTheme(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (theme === undefined) return
    if (theme === null) {
      delete document.documentElement.dataset.theme
    } else {
      document.documentElement.dataset.theme = theme
    }
  }, [theme])

  const choose = useCallback((next: Theme) => {
    chooseTheme(next).then(setTheme)
  }, [])

  return { theme, choose }
}
