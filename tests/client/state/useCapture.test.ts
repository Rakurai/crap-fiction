import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CaptureApproveOutcome, CaptureDestination, CaptureProposal } from '../../../src/shared/captureProposal.js'
import type { CaptureOutcome } from '../../../src/shared/captureViews.js'
import type { RequestResult } from '../../../src/client/request.js'
import { useCapture, type CaptureAdapters } from '../../../src/client/useCapture.js'

function proposal(identity: { id: string; destination: CaptureDestination; section?: string }): CaptureProposal {
  return { section: 'Voice', operation: 'add', text: 'wry and close', ...identity }
}

function adapters(overrides: Partial<CaptureAdapters> = {}): CaptureAdapters {
  return {
    captureContext: vi.fn(),
    approveCapture: vi.fn(),
    ...overrides,
  }
}

describe('useCapture', () => {
  it('does nothing until a conversation is current', () => {
    const room = adapters()
    const { result } = renderHook(() => useCapture('the-lighthouse', null, () => 'draft', room))

    act(() => result.current.capture())

    expect(room.captureContext).not.toHaveBeenCalled()
    expect(result.current.capturing).toBe(false)
  })

  it('carries the draft into the call and holds what came back — the proposals, none approved yet, or the failure as an error and nothing proposed', async () => {
    const proposals = [proposal({ id: 'p1', destination: 'storyContext' })]
    const room = adapters({
      captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: { outcome: 'captured', proposals } })),
    })

    const { result } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'The cups sat where she left them.', room))

    await act(async () => result.current.capture())

    expect(room.captureContext).toHaveBeenCalledWith('the-lighthouse', 'c1', 'The cups sat where she left them.')
    expect(result.current.proposals).toEqual(proposals)
    expect(result.current.approved.size).toBe(0)

    const failing = adapters({
      captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: { outcome: 'failed', reason: 'unconfigured' } })),
    })
    const { result: failed } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'draft', failing))

    await act(async () => failed.current.capture())

    expect(failed.current.proposals).toEqual([])
    expect(failed.current.error).toContain('unconfigured')
  })

  it('writes only the approved proposals, asking nothing where none were, and discards everything once every write lands', async () => {
    const nothingApproved = [proposal({ id: 'p1', destination: 'storyContext' })]
    const idle = adapters({
      captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: { outcome: 'captured', proposals: nothingApproved } })),
    })
    const { result: unapproved } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'draft', idle))
    await act(async () => unapproved.current.capture())

    act(() => unapproved.current.close())

    expect(idle.approveCapture).not.toHaveBeenCalled()
    expect(unapproved.current.proposals).toEqual([])

    const proposals = [proposal({ id: 'p1', destination: 'storyContext' }), proposal({ id: 'p2', destination: 'authorContext' })]
    const approveOutcome: CaptureApproveOutcome = { written: ['storyContext'], failures: [] }
    const room = adapters({
      captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: { outcome: 'captured', proposals } })),
      approveCapture: vi.fn(async (): Promise<RequestResult<CaptureApproveOutcome>> => ({ outcome: 'value', value: approveOutcome })),
    })

    const { result } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'draft', room))
    await act(async () => result.current.capture())
    act(() => result.current.toggle('p1'))

    await act(async () => result.current.close())

    expect(room.approveCapture).toHaveBeenCalledWith('the-lighthouse', [proposals[0]])
    expect(result.current.proposals).toEqual([])
    expect(result.current.error).toBeUndefined()
  })

  it('SPEC "Context capture": keeps every proposal for a destination that failed to write, approved or not, and states the failure', async () => {
    const proposals = [
      proposal({ id: 'p1', destination: 'storyContext' }),
      proposal({ id: 'p2', destination: 'storyContext', section: 'Premise' }),
      proposal({ id: 'p3', destination: 'authorContext' }),
    ]
    const approveOutcome: CaptureApproveOutcome = {
      written: ['authorContext'],
      failures: [{ destination: 'storyContext', message: 'disk is full' }],
    }
    const room = adapters({
      captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: { outcome: 'captured', proposals } })),
      approveCapture: vi.fn(async (): Promise<RequestResult<CaptureApproveOutcome>> => ({ outcome: 'value', value: approveOutcome })),
    })

    const { result } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'draft', room))
    await act(async () => result.current.capture())
    act(() => {
      result.current.toggle('p1')
      result.current.toggle('p3')
    })

    await act(async () => result.current.close())

    expect(result.current.proposals.map((proposal) => proposal.id)).toEqual(['p1', 'p2'])
    expect(result.current.approved).toEqual(new Set(['p1']))
    expect(result.current.error).toContain('disk is full')
  })
})
