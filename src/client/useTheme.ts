import { useCallback, useEffect, useState } from 'react'
import type { Theme } from '../server/interfaceTheme.js'
import { chooseTheme, fetchTheme } from './themeClient.js'
import { isAbortError } from './request.js'

export type ThemeViewModel = {
  /** `undefined` while loading, `null` when the author has not chosen. */
  readonly theme: Theme | null | undefined
  readonly loadError: string | undefined
  readonly chooseError: string | undefined
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
  const [loadError, setLoadError] = useState<string | undefined>(undefined)
  const [chooseError, setChooseError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    fetchTheme(controller.signal)
      .then((value) => setTheme(value))
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setLoadError(err instanceof Error ? err.message : 'failed to load theme')
      })
    return () => controller.abort()
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
    setChooseError(undefined)
    chooseTheme(next)
      .then((result) => {
        if (result.ok) {
          setTheme(result.theme)
        } else {
          setChooseError(result.message)
        }
      })
      .catch((err: unknown) => {
        setChooseError(err instanceof Error ? err.message : 'failed to set theme')
      })
  }, [])

  return { theme, loadError, chooseError, choose }
}
