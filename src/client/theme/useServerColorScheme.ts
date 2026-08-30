import { useCallback, useEffect, useState } from 'react'
import { useColorScheme } from '@mui/material/styles'
import { z } from 'zod'
import { responseEnvelopeSchema } from '../../shared/envelope.js'
import { themeSchema, type Theme } from '../../shared/theme.js'

const themeResultSchema = z.object({ theme: themeSchema.nullable() })
const themeEnvelopeSchema = responseEnvelopeSchema(themeResultSchema)

async function readEnvelope(response: Response): Promise<Theme | null> {
  if (!response.ok) throw new Error(`the theme route answered with status ${response.status}`)
  const envelope = themeEnvelopeSchema.parse(await response.json())
  if (!envelope.success) throw new Error(envelope.error.message)
  return envelope.data.theme
}

async function fetchServerTheme(): Promise<Theme | null> {
  return readEnvelope(await fetch('/theme'))
}

async function putServerTheme(theme: Theme): Promise<void> {
  await readEnvelope(
    await fetch('/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ theme }),
    }),
  )
}

export type SchemeState =
  | { readonly status: 'loading' }
  | { readonly status: 'unset' }
  | { readonly status: 'confirmed'; readonly theme: Theme }
  | { readonly status: 'unavailable' }

export type ServerColorScheme = Readonly<{
  state: SchemeState
  choose: (theme: Theme) => void
}>

export function useServerColorScheme(): ServerColorScheme {
  const { setMode } = useColorScheme()
  const [state, setState] = useState<SchemeState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchServerTheme()
      .then((theme) => {
        if (cancelled) return
        setMode(theme ?? 'dark')
        setState(theme === null ? { status: 'unset' } : { status: 'confirmed', theme })
      })
      .catch(() => {
        if (cancelled) return
        setMode('dark')
        setState({ status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [setMode])

  const choose = useCallback(
    (theme: Theme) => {
      setMode(theme)
      setState({ status: 'confirmed', theme })
      void putServerTheme(theme).catch(() => {
        setState({ status: 'unavailable' })
      })
    },
    [setMode],
  )

  return { state, choose }
}
