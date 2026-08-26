import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CastMemberView, PieceDetail, SurfaceDetail } from '../../../src/shared/pieceViews.js'
import type { RequestResult } from '../../../src/client/request.js'
import type { PieceAdapters } from '../../../src/client/usePiece.js'
import { useSurfaceCast } from '../../../src/client/useSurfaceCast.js'

/** Only the piece update this hook makes is stated; asking the studio for the piece is not. */
function adapters(updatePiece: PieceAdapters['updatePiece']): PieceAdapters {
  return {
    fetchPiece: vi.fn(() => {
      throw new Error('unreached: this hook never asks the studio for the piece')
    }) as unknown as PieceAdapters['fetchPiece'],
    updatePiece,
  }
}

function member(id: string, enabled: boolean): CastMemberView {
  return { id, handle: id, displayName: id, description: `about ${id}`, enabled }
}

const SHAPE = member('shape', false)
const READER = member('reader', false)

function surface(cast: readonly CastMemberView[]): SurfaceDetail {
  return { text: '', referenceSchema: null, currentConversationId: null, conversations: [], cast }
}

function detailWith(cast: readonly CastMemberView[]): RequestResult<PieceDetail> {
  return {
    outcome: 'value',
    value: {
      id: 'the-lighthouse',
      title: 'The Lighthouse',
      mode: 'flash',
      length: 0,
      modified: 1_700_000_000_000,
      surfaces: { draft: surface(cast), storyContext: surface([]), authorContext: surface([]) },
      storyEditor: { handle: 'editor', displayName: 'Story Editor', description: 'weighs the whole' },
      interviewer: { handle: 'interview', displayName: 'Interviewer', description: 'asks one question', invocation: 'ask me a clarifying question' },
    },
  }
}

describe('one surface’s cast', () => {
  it('serializes whole-cast replacements so a second toggle includes the first one still being saved', async () => {
    const signals: AbortSignal[] = []
    let answerTheFirst: (result: RequestResult<PieceDetail>) => void = () => {
      throw new Error('nothing was asked of the studio')
    }
    const updatePiece = vi
      .fn()
      .mockImplementationOnce((_id: string, _patch: unknown, signal: AbortSignal) => {
        signals.push(signal)
        return new Promise<RequestResult<PieceDetail>>((resolve) => (answerTheFirst = resolve))
      })
      .mockImplementationOnce((_id: string, _patch: unknown, signal: AbortSignal) => {
        signals.push(signal)
        return Promise.resolve(detailWith([member('shape', true), member('reader', true)]))
      })

    const { result } = renderHook(() => useSurfaceCast('the-lighthouse', 'draft', [SHAPE, READER], adapters(updatePiece)))

    act(() => result.current.toggle('shape'))
    await act(async () => {
      result.current.toggle('reader')
    })

    expect(signals[0]?.aborted).toBe(false)
    expect(result.current.members.map((each) => each.enabled)).toEqual([false, false])

    await act(async () => {
      answerTheFirst(detailWith([member('shape', true), member('reader', false)]))
    })

    expect(result.current.members.map((each) => each.enabled)).toEqual([true, true])
    expect(result.current.toggling).toBeUndefined()
  })

  it('abandons the request still in flight when the surface goes away', async () => {
    let signal: AbortSignal | undefined
    const updatePiece = vi.fn((_id: string, _patch: unknown, given?: AbortSignal) => {
      signal = given
      return new Promise<RequestResult<PieceDetail>>(() => {})
    })

    const { result, unmount } = renderHook(() => useSurfaceCast('the-lighthouse', 'draft', [SHAPE], adapters(updatePiece)))

    await act(async () => result.current.toggle('shape'))
    unmount()

    expect(signal?.aborted).toBe(true)
  })
})
