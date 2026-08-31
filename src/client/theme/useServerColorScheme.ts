import { useCallback, useEffect } from 'react'
import { useColorScheme } from '@mui/material/styles'
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { z } from 'zod'
import { themeSchema, type Theme } from '../../shared/theme.js'
import { readState, type ReadState } from '../servedFacts/readState.js'
import { get, put, type RequestFailure } from '../servedFacts/transport.js'

const themeReadSchema = z.object({ theme: themeSchema.nullable() })
const themeWriteSchema = z.object({ theme: themeSchema })

const THEME_KEY = ['theme'] as const

const THEME_UNTIL_READ: Theme = 'dark'

export type SchemeState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'unset' }>
  | Readonly<{ status: 'confirmed'; theme: Theme }>
  | Readonly<{ status: 'unavailable' }>

export type SchemeSave =
  | Readonly<{ status: 'settled' }>
  | Readonly<{ status: 'saving'; theme: Theme }>
  | Readonly<{ status: 'unsaved'; theme: Theme; message: string }>

export type ServerColorScheme = Readonly<{
  state: SchemeState
  save: SchemeSave
  showing: Theme
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

function saveState(mutation: UseMutationResult<Theme, RequestFailure, Theme>): SchemeSave {
  if (mutation.isPending) return { status: 'saving', theme: mutation.variables }
  if (mutation.isError) return { status: 'unsaved', theme: mutation.variables, message: mutation.error.message }
  return { status: 'settled' }
}

export function useServerColorScheme(): ServerColorScheme {
  const { setMode } = useColorScheme()
  const queryClient = useQueryClient()

  const query = useQuery<Theme | null, RequestFailure>({
    queryKey: THEME_KEY,
    queryFn: async ({ signal }) => (await get('/theme', themeReadSchema, signal)).theme,
  })

  const state = toSchemeState(readState(query))
  const showing = state.status === 'confirmed' ? state.theme : THEME_UNTIL_READ

  useEffect(() => {
    if (query.status !== 'pending') setMode(showing)
  }, [query.status, showing, setMode])

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

  return { state, save: saveState(mutation), showing, choose }
}
