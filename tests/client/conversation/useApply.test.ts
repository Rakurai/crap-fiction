import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AutosaveState } from '../../../src/client/autosave.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { ConversationViewModel, ResumedApply } from '../../../src/client/useConversation.js'
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
    retrievePendingApply: vi.fn(() => Promise.resolve<RequestResult<PendingApply>>({ outcome: 'value', value: { replacement: 'the resumed text' } })),
    ...overrides,
  }
}

function owner(released = true): ConversationViewModel['abandonAction'] {
  return vi.fn(() => Promise.resolve(released))
}

describe('installing a pending Apply result', () => {
  it('writes it once through the surface persistence owner and confirms only after that write settles', async () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters()
    const abandonAction = owner()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, abandonAction))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(room.confirmApplication).toHaveBeenCalled())

    expect(install).toHaveBeenCalledOnce()
    expect(install).toHaveBeenCalledWith('the applied text')
    expect(room.confirmApplication).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'app1', expect.any(AbortSignal))
    expect(abandonAction).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBeUndefined()
  })

  it('a failed write terminates the Apply, unlocks the surface, states the failure and abandons the pending server state', async () => {
    const install = vi.fn(() => Promise.resolve<AutosaveState>({ failed: true, message: 'disk unhappy', atMs: 1 }))
    const room = adapters()
    const abandonAction = owner()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, abandonAction))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBe('disk unhappy')
    expect(room.confirmApplication).not.toHaveBeenCalled()
    expect(abandonAction).toHaveBeenCalledWith('c1', 'a1', 'disk unhappy')
  })

  it('a failed confirmation likewise terminates the Apply, unlocks the surface and abandons the pending server state', async () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters({
      confirmApplication: vi.fn(() => Promise.resolve<RequestResult<ApplyConfirmation>>({ outcome: 'refused', code: 'APPLICATION_DOCUMENT_NOT_SAVED', message: 'the target moved' })),
    })
    const abandonAction = owner()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, abandonAction))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBe('the target moved')
    expect(abandonAction).toHaveBeenCalledWith('c1', 'a1', 'the target moved')
  })

  it('stays locked when the abandonment itself fails, rather than unlocking a surface the room still holds an Apply for', async () => {
    const install = vi.fn(() => Promise.resolve<AutosaveState>({ failed: true, message: 'disk unhappy', atMs: 1 }))
    const room = adapters()
    const abandonAction = owner(false)

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, abandonAction))

    act(() => {
      result.current.apply('e1', undefined)
    })

    await waitFor(() => expect(abandonAction).toHaveBeenCalledWith('c1', 'a1', 'disk unhappy'))
    expect(result.current.applying).toEqual({ responseId: 'e1' })
  })
})

describe('resuming a pending Apply the room reported already in flight on reconnect', () => {
  const RESUMED: ResumedApply = { actionId: 'a1', responseId: 'e1', applicationId: 'app1' }

  it('retrieves the generated document by identity, installs it and confirms it, calling no model', async () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, owner(), RESUMED))

    expect(result.current.applying).toEqual({ responseId: 'e1' })
    await waitFor(() => expect(room.confirmApplication).toHaveBeenCalled())

    expect(room.retrievePendingApply).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'app1', expect.any(AbortSignal))
    expect(room.applyRecommendation).not.toHaveBeenCalled()
    expect(install).toHaveBeenCalledWith('the resumed text')
    expect(room.confirmApplication).toHaveBeenCalledWith('the-lighthouse', 'draft', 'c1', 'app1', expect.any(AbortSignal))
    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBeUndefined()
  })

  it('shows the Apply in flight without retrieving anything while the model call itself is still running', () => {
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters()

    const { result } = renderHook(() =>
      useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, owner(), { ...RESUMED, applicationId: undefined }),
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
    const abandonAction = owner()

    const { result } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, abandonAction, RESUMED))

    await waitFor(() => expect(result.current.applying).toBeUndefined())
    expect(result.current.error).toBe('the studio did not answer')
    expect(install).not.toHaveBeenCalled()
    expect(abandonAction).toHaveBeenCalledWith('c1', 'a1', 'the studio did not answer')
  })

  it('does not install nor confirm a retrieval that settles after the surface has unmounted', async () => {
    let resolveRetrieval: (result: RequestResult<PendingApply>) => void = () => {
      throw new Error('the pending application was never asked for')
    }
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters({
      retrievePendingApply: vi.fn(() => new Promise<RequestResult<PendingApply>>((resolve) => (resolveRetrieval = resolve))),
    })

    const { unmount } = renderHook(() => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, owner(), RESUMED))

    unmount()

    await act(async () => {
      resolveRetrieval({ outcome: 'value', value: { replacement: 'the resumed text' } })
    })

    expect(install).not.toHaveBeenCalled()
    expect(room.confirmApplication).not.toHaveBeenCalled()
  })

  it('installs the retrieval for the application that is current when it settles, not one superseded by a later dep change resolving after it', async () => {
    let resolveFirst: (result: RequestResult<PendingApply>) => void = () => {
      throw new Error('the first application was never asked for')
    }
    const retrievePendingApply = vi
      .fn()
      .mockImplementationOnce(() => new Promise<RequestResult<PendingApply>>((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => Promise.resolve<RequestResult<PendingApply>>({ outcome: 'value', value: { replacement: 'second text' } }))
    const install = vi.fn(() => Promise.resolve(SAVED))
    const room = adapters({ retrievePendingApply })

    const { rerender } = renderHook(
      ({ resumed }: { resumed: ResumedApply }) => useApply('the-lighthouse', 'draft', 'c1', () => DOCUMENTS, install, room, owner(), resumed),
      { initialProps: { resumed: { actionId: 'a1', responseId: 'e1', applicationId: 'app1' } } },
    )

    rerender({ resumed: { actionId: 'a2', responseId: 'e2', applicationId: 'app2' } })

    await waitFor(() => expect(install).toHaveBeenCalledWith('second text'))

    await act(async () => {
      resolveFirst({ outcome: 'value', value: { replacement: 'first text' } })
    })

    expect(install).toHaveBeenCalledOnce()
    expect(install).not.toHaveBeenCalledWith('first text')
  })
})
