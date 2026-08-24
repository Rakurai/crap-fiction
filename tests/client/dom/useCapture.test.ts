import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CaptureApproveOutcome, CaptureProposal } from '../../../src/shared/captureProposal.js'
import type { CaptureOutcome } from '../../../src/shared/captureViews.js'
import type { RequestResult } from '../../../src/client/request.js'
import { useCapture, type CaptureAdapters } from '../../../src/client/useCapture.js'

function proposal(overrides: Partial<CaptureProposal> & Pick<CaptureProposal, 'id' | 'destination'>): CaptureProposal {
  return { section: 'Voice', operation: 'add', entry: undefined, text: 'wry and close', ...overrides }
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

  it('holds the proposals the call returned, none of them approved by default', async () => {
    const proposals = [proposal({ id: 'p1', destination: 'storyContext' })]
    const outcome: CaptureOutcome = { outcome: 'captured', proposals }
    const room = adapters({ captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: outcome })) })

    const { result } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'The cups sat where she left them.', room))

    await act(async () => result.current.capture())

    expect(room.captureContext).toHaveBeenCalledWith('the-lighthouse', 'c1', 'The cups sat where she left them.')
    expect(result.current.proposals).toEqual(proposals)
    expect(result.current.approved.size).toBe(0)
  })

  it('states a failed call as an error, proposing nothing', async () => {
    const outcome: CaptureOutcome = { outcome: 'failed', reason: 'unconfigured' }
    const room = adapters({ captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: outcome })) })

    const { result } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'draft', room))

    await act(async () => result.current.capture())

    expect(result.current.proposals).toEqual([])
    expect(result.current.error).toContain('unconfigured')
  })

  it('closing with nothing approved discards every proposal without a request', async () => {
    const proposals = [proposal({ id: 'p1', destination: 'storyContext' })]
    const room = adapters({
      captureContext: vi.fn(async (): Promise<RequestResult<CaptureOutcome>> => ({ outcome: 'value', value: { outcome: 'captured', proposals } })),
      approveCapture: vi.fn(),
    })

    const { result } = renderHook(() => useCapture('the-lighthouse', 'c1', () => 'draft', room))
    await act(async () => result.current.capture())

    act(() => result.current.close())

    expect(room.approveCapture).not.toHaveBeenCalled()
    expect(result.current.proposals).toEqual([])
  })

  it('writes only the approved proposals, and discards everything once every write lands', async () => {
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
