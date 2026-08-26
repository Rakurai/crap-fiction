import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AutosaveState } from '../../../src/client/autosave.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { ResumedApply } from '../../../src/client/useConversation.js'
import type { ApplyAdapters } from '../../../src/client/useApply.js'
import { useApply } from '../../../src/client/useApply.js'
import type { ApplyConfirmation, ApplyOutcome, PendingApply } from '../../../src/shared/applyViews.js'
import type { DocumentSnapshot } from '../../../src/shared/surfaces.js'

const DOCUMENTS: DocumentSnapshot = { draft: 'the draft', storyContext: '', authorContext: '' }
const SAVED: AutosaveState = { failed: false }
const CONFIRMATION: ApplyConfirmation = { entryId: 'e-app1', change: { kind: 'rewrittenWhole' } }

const PENDING: ApplyOutcome = { outcome: 'pending', actionId: 'a1', applicationId: 'app1', replacement: 'the applied text' }

function adapters(overrides: Partial<ApplyAdapters> = {}): ApplyAdapters {
  return {
    applyRecommendation: vi.fn(() => Promise.resolve<RequestResult<ApplyOutcome>>({ outcome: 'value', value: PENDING })),
    confirmApplication: vi.fn(() => Promise.resolve<RequestResult<ApplyConfirmation>>({ outcome: 'value', value: CONFIRMATION })),
    abandonOperation: vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'value', value: null })),
    retrievePendingApply: vi.fn(() => Promise.resolve<RequestResult<PendingApply>>({ outcome: 'value', value: { replacement: 'the resumed text' } })),
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

  it('stays locked when the abandonment itself fails, rather than unlocking a surface the room still holds an Apply for', async () => {
    const install = vi.fn(() => Promise.resolve<AutosaveState>({ failed: true, message: 'disk unhappy', atMs: 1 }))
    const room = adapters({
      abandonOperation: vi.fn(() => Promise.resolve<RequestResult<null>>({ outcome: 'unreachable', message: 'the studio did not answer' })),
    })

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(result.current.error).toBe('disk unhappy — the studio did not answer'))
    expect(result.current.applying).toEqual({ responseId: 'e1' })
  })
})

describe('resuming a pending Apply the room reported already in flight on reconnect', () => {
  const RESUMED: ResumedApply = { actionId: 'a1', responseId: 'e1', applicationId: 'app1' }

  it('retrieves the generated document by identity, installs it and confirms it, calling no model', async () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, RESUMED))

    expect(result.current.applying).toEqual({ responseId: 'e1' })
    await waitFor(() => expect(room.confirmApplication).toHaveBeenCalled())

    expect(room.retrievePendingApply).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'app1')
    expect(room.applyRecommendation).not.toHaveBeenCalled()
    expect(install).toHaveBeenCalledWith('the resumed text')
    expect(room.confirmApplication).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'app1')
    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBeUndefined()
  })

  it('shows the Apply in flight without retrieving anything while the model call itself is still running', () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters()

    const { result } = renderHook(() =>
      useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, { ...RESUMED, applicationId: undefined }),
    )

    expect(result.current.applying).toEqual({ responseId: 'e1' })
    expect(room.retrievePendingApply).not.toHaveBeenCalled()
    expect(install).not.toHaveBeenCalled()
  })

  it('a failed retrieval terminates the Apply, unlocks the surface and abandons the pending server state', async () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters({
      retrievePendingApply: vi.fn(() => Promise.resolve<RequestResult<PendingApply>>({ outcome: 'unreachable', message: 'the studio did not answer' })),
    })

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, RESUMED))

    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBe('the studio did not answer')
    expect(install).not.toHaveBeenCalled()
    expect(room.abandonOperation).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'a1')
  })
})
