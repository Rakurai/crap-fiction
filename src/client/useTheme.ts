import { useCallback, useEffect, useRef, useState } from 'react'
import type { Theme } from '../shared/theme.js'
import { useLoaded } from './load.js'
import { failureMessage } from './request.js'
import { chooseTheme, fetchTheme } from './themeClient.js'

export type ThemeViewModel = {
  readonly theme: Theme | null | undefined
  readonly loadError: string | undefined
  readonly chooseError: string | undefined
  readonly choose: (theme: Theme) => void
}

export function useTheme(): ThemeViewModel {
  const [load, setLoad] = useLoaded(fetchTheme, [])
  const [chooseError, setChooseError] = useState<string | undefined>(undefined)
  const controllerRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => () => controllerRef.current?.abort(), [])

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
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setChooseError(undefined)
    void chooseTheme(next, controller.signal).then((result) => {
      if (controllerRef.current !== controller) return
      controllerRef.current = undefined
      if (result.outcome === 'value') {
        setLoad({ kind: 'ready', value: { theme: result.value.theme } })
        return
      }
      setChooseError(failureMessage(result))
    })
  }, [])

  return { theme, loadError: load.kind === 'error' ? load.message : undefined, chooseError, choose }
}
