import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AutosaveState } from '../../../src/client/autosave.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { ApplyAdapters } from '../../../src/client/useApply.js'
import { useApply } from '../../../src/client/useApply.js'
import type { ApplyConfirmation, ApplyOutcome } from '../../../src/shared/applyViews.js'
import type { DocumentSnapshot } from '../../../src/shared/surfaces.js'

const DOCUMENTS: DocumentSnapshot = { draft: 'the draft', storyContext: '', authorContext: '' }
const SAVED: AutosaveState = { failed: false }
const CONFIRMATION: ApplyConfirmation = { entryId: 'e-app1', change: { kind: 'rewrittenWhole' } }

const PENDING: ApplyOutcome = { outcome: 'pending', actionId: 'a1', applicationId: 'app1', manuscript: 'the applied text' }

function adapters(overrides: Partial<ApplyAdapters> = {}): ApplyAdapters {
  return {
    applyRecommendation: vi.fn(() => Promise.resolve<RequestResult<ApplyOutcome>>({ outcome: 'value', value: PENDING })),
    confirmApplication: vi.fn(() => Promise.resolve<RequestResult<ApplyConfirmation>>({ outcome: 'value', value: CONFIRMATION })),
    abandonOperation: vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null })),
    ...overrides,
  }
}

describe('installing a pending Apply result', () => {
  it('writes it once through the surface persistence owner and confirms only after that write settles', async () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(room.confirmApplication).toHaveBeenCalled())

    expect(install).toHaveBeenCalledOnce()
    expect(install).toHaveBeenCalledWith('the applied text')
    expect(room.confirmApplication).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'app1')
    expect(room.abandonOperation).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBeUndefined()
  })

  it('a failed write terminates the Apply, unlocks the surface, states the failure and abandons the pending server state', async () => {
    const install = vi.fn(() => Promise.resolve<AutosaveState>({ failed: true, message: 'disk unhappy', atMs: 1 }))
    const room = adapters()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBe('disk unhappy')
    expect(room.confirmApplication).not.toHaveBeenCalled()
    expect(room.abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'a1')
  })

  it('a failed confirmation likewise terminates the Apply, unlocks the surface and abandons the pending server state', async () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters({
      confirmApplication: vi.fn(() => Promise.resolve<RequestResult<ApplyConfirmation>>({ outcome: 'refused', code: 'APPLICATION_DOCUMENT_NOT_SAVED', message: 'the target moved' })),
    })

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBe('the target moved')
    expect(room.abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'a1')
  })
})
