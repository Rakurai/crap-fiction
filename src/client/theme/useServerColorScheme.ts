import { useCallback, useEffect } from 'react'
import { useColorScheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { themeSchema, type Theme } from '../../shared/theme.js'
import { readState, type ReadState } from '../servedFacts/readState.js'
import { get, put, type RequestFailure } from '../servedFacts/transport.js'

const themeReadSchema = z.object({ theme: themeSchema.nullable() })
const themeWriteSchema = z.object({ theme: themeSchema })

const THEME_KEY = ['theme'] as const

export type SchemeState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'unset' }>
  | Readonly<{ status: 'confirmed'; theme: Theme }>
  | Readonly<{ status: 'unavailable' }>

export type ServerColorScheme = Readonly<{
  state: SchemeState
  choose: (theme: Theme) => void
}>

function toSchemeState(read: ReadState<Theme | null>): SchemeState {
  switch (read.status) {
    case 'notArrived':
      return { status: 'loading' }
    case 'failed':
      return { status: 'unavailable' }
    case 'present':
    case 'refreshFailed':
      return read.value === null ? { status: 'unset' } : { status: 'confirmed', theme: read.value }
    default: {
      const exhaustive: never = read
      return exhaustive
    }
  }
}

export function useServerColorScheme(): ServerColorScheme {
  const { setMode } = useColorScheme()
  const queryClient = useQueryClient()

  const query = useQuery<Theme | null, RequestFailure>({
    queryKey: THEME_KEY,
    queryFn: async ({ signal }) => (await get('/theme', themeReadSchema, signal)).theme,
  })

  useEffect(() => {
    if (query.status !== 'pending') setMode(query.data ?? 'dark')
  }, [query.status, query.data, setMode])

  const mutation = useMutation<Theme, RequestFailure, Theme>({
    mutationFn: async (theme) => (await put('/theme', themeWriteSchema, { theme })).theme,
    onSuccess: (theme) => queryClient.setQueryData(THEME_KEY, theme),
  })

  const choose = useCallback(
    (theme: Theme) => {
      setMode(theme)
      mutation.mutate(theme)
    },
    [setMode, mutation.mutate],
  )

  const state: SchemeState = mutation.isError ? { status: 'unavailable' } : toSchemeState(readState(query))

  return { state, choose }
}
