import type { UseQueryResult } from '@tanstack/react-query'
import type { RequestFailure } from './transport.js'

export type ReadState<T> =
  | Readonly<{ status: 'notArrived' }>
  | Readonly<{ status: 'failed'; failure: RequestFailure }>
  | Readonly<{ status: 'present'; value: T }>
  | Readonly<{ status: 'refreshFailed'; value: T; failure: RequestFailure }>

export function readState<T>(result: UseQueryResult<T, RequestFailure>): ReadState<T> {
  if (result.isLoadingError) return { status: 'failed', failure: result.error }
  if (result.isRefetchError) return { status: 'refreshFailed', value: result.data, failure: result.error }
  if (result.isPending) return { status: 'notArrived' }
  return { status: 'present', value: result.data }
}

export function presentValue<T>(state: ReadState<T>): T | null {
  return state.status === 'present' || state.status === 'refreshFailed' ? state.value : null
}
