import { describe, expect, it, vi } from 'vitest'
import type { AutosaveState } from '../../../src/client/autosave.js'
import { closePiece } from '../../../src/client/closePiece.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { abandonOperation as abandonOperationFn } from '../../../src/client/roomClient.js'

const SAVED: AutosaveState = { failed: false }
const FAILED: AutosaveState = { failed: true, message: 'disk unhappy', atMs: 1 }

function flushers(overrides: Partial<Record<'draft' | 'storyContext' | 'authorContext', AutosaveState>> = {}) {
  return {
    draft: vi.fn(() => Promise.resolve(overrides.draft ?? SAVED)),
    storyContext: vi.fn(() => Promise.resolve(overrides.storyContext ?? SAVED)),
    authorContext: vi.fn(() => Promise.resolve(overrides.authorContext ?? SAVED)),
  }
}

describe('closing an open piece', () => {
  it('flushes every surface and, once every write has durably settled, is free to leave with nothing in flight', async () => {
    const flush = flushers()
    const abandonOperation = vi.fn<typeof abandonOperationFn>(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null }))

    const result = await closePiece('the-lighthouse', flush, {}, abandonOperation)

    expect(flush.draft).toHaveBeenCalledOnce()
    expect(flush.storyContext).toHaveBeenCalledOnce()
    expect(flush.authorContext).toHaveBeenCalledOnce()
    expect(abandonOperation).not.toHaveBeenCalled()
    expect(result).toEqual({ blocked: false, abandonFailures: [] })
  })

  it('stays blocked on a failed write and asks nothing to abandon — durable prose is what this protects', async () => {
    const flush = flushers({ draft: FAILED })
    const abandonOperation = vi.fn<typeof abandonOperationFn>(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null }))

    const result = await closePiece(
      'the-lighthouse',
      flush,
      { draft: { conversationId: 'c1', actionId: 'a1' } },
      abandonOperation,
    )

    expect(abandonOperation).not.toHaveBeenCalled()
    expect(result.blocked).toBe(true)
  })

  it('abandons what every surface still has in flight, bounded, only once persistence has settled', async () => {
    const flush = flushers()
    const abandonOperation = vi.fn<typeof abandonOperationFn>(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null }))

    await closePiece(
      'the-lighthouse',
      flush,
      { draft: { conversationId: 'c1', actionId: 'a1' }, storyContext: { conversationId: 'c2', actionId: 'a2' } },
      abandonOperation,
    )

    expect(abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'a1', expect.any(AbortSignal))
    expect(abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'storyContext', 'c2', 'a2', expect.any(AbortSignal))
    expect(abandonOperation).not.toHaveBeenCalledWith('the-lighthouse', 'authorContext', expect.anything(), expect.anything(), expect.anything())
  })

  it('reports a failed abandonment rather than swallowing it, and still leaves — the server, not this request, is authoritative', async () => {
    const flush = flushers()
    const abandonOperation = vi.fn<typeof abandonOperationFn>(() =>
      Promise.resolve<RequestResult<null>>({ outcome: 'unreachable', message: 'the studio did not answer' }),
    )

    const result = await closePiece('the-lighthouse', flush, { draft: { conversationId: 'c1', actionId: 'a1' } }, abandonOperation)

    expect(result).toEqual({ blocked: false, abandonFailures: ['the studio did not answer'] })
  })
})
