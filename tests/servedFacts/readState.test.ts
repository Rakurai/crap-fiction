import type { UseQueryResult } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { readState } from '../../src/client/servedFacts/readState.js'
import { RequestFailure } from '../../src/client/servedFacts/transport.js'

function fakeResult<T>(fields: Partial<UseQueryResult<T, RequestFailure>>): UseQueryResult<T, RequestFailure> {
  return {
    isLoadingError: false,
    isRefetchError: false,
    isPending: false,
    data: undefined,
    error: null,
    ...fields,
  } as unknown as UseQueryResult<T, RequestFailure>
}

describe('deriving the read-state presentation from a query result', () => {
  it('reports a value that has not arrived while the first read is outstanding', () => {
    expect(readState(fakeResult({ isPending: true }))).toEqual({ status: 'notArrived' })
  })

  it('reports a failed first read with no prior value to fall back on', () => {
    const failure = new RequestFailure('the studio could not be reached', { kind: 'unreachable' })
    expect(readState(fakeResult({ isLoadingError: true, error: failure }))).toEqual({ status: 'failed', failure })
  })

  it('reports a present value once a read has resolved', () => {
    expect(readState(fakeResult({ data: 'dark' }))).toEqual({ status: 'present', value: 'dark' })
  })

  it('reports a failed refresh without discarding the value already on screen', () => {
    const failure = new RequestFailure('the studio could not be reached', { kind: 'unreachable' })
    expect(readState(fakeResult({ isRefetchError: true, data: 'dark', error: failure }))).toEqual({
      status: 'refreshFailed',
      value: 'dark',
      failure,
    })
  })
})
