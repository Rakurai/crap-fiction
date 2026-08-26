import { describe, expect, it, vi } from 'vitest'
import type { AutosaveState } from '../../../src/client/autosave.js'
import { closePiece } from '../../../src/client/closePiece.js'

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
  it('flushes every surface and, once every write has durably settled, is free to leave', async () => {
    const flush = flushers()

    const result = await closePiece(flush)

    expect(flush.draft).toHaveBeenCalledOnce()
    expect(flush.storyContext).toHaveBeenCalledOnce()
    expect(flush.authorContext).toHaveBeenCalledOnce()
    expect(result).toEqual({ blocked: false })
  })

  it('refuses to leave where a surface registered no writer, rather than reading it as a surface with nothing to save', async () => {
    const draft = vi.fn(() => Promise.resolve(SAVED))

    const result = await closePiece({ draft })

    expect(result).toEqual({ blocked: true })
    expect(draft).not.toHaveBeenCalled()
  })

  it('stays blocked on any surface’s failed write, not only the one the author was looking at', async () => {
    const result = await closePiece(flushers({ storyContext: FAILED }))

    expect(result.blocked).toBe(true)
  })
})
