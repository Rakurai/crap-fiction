import { useCallback, useEffect, useState } from 'react'
import type { Theme } from '../shared/theme.js'
import { useLoaded } from './load.js'
import { failureMessage } from './request.js'
import { chooseTheme, fetchTheme } from './themeClient.js'

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
  const [load, setLoad] = useLoaded(fetchTheme, [])
  const [chooseError, setChooseError] = useState<string | undefined>(undefined)

  const theme = load.kind === 'ready' ? load.value.theme : undefined

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
    void chooseTheme(next).then((result) => {
      if (result.outcome === 'value') {
        setLoad({ kind: 'ready', value: { theme: result.value.theme } })
        return
      }
      setChooseError(failureMessage(result))
    })
  }, [])

  return { theme, loadError: load.kind === 'error' ? load.message : undefined, chooseError, choose }
}
