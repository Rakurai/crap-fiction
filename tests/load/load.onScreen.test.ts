import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RequestResult } from '../../src/client/request.js'
import { useLoaded } from '../../src/client/load.js'

describe('useLoaded', () => {
  it('installs the value from the request that is current when it settles, not one superseded by a later dep change resolving after it', async () => {
    let resolveFirst: (result: RequestResult<string>) => void = () => {
      throw new Error('the first request was never made')
    }
    const load = vi
      .fn()
      .mockImplementationOnce(() => new Promise<RequestResult<string>>((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => Promise.resolve<RequestResult<string>>({ outcome: 'value', value: 'second' }))

    const { result, rerender } = renderHook(({ id }: { id: string }) => useLoaded((signal) => load(id, signal), [id]), {
      initialProps: { id: 'a' },
    })

    rerender({ id: 'b' })

    await act(async () => {})
    expect(result.current[0]).toEqual({ kind: 'ready', value: 'second' })

    await act(async () => {
      resolveFirst({ outcome: 'value', value: 'first' })
    })

    expect(result.current[0]).toEqual({ kind: 'ready', value: 'second' })
  })
})
