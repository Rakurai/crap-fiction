import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RequestResult } from '../../src/client/request.js'
import { usePlainTextSession, useProseSession } from '../../src/client/useDocumentSession.js'

const refused = (message: string): RequestResult<null> => ({ outcome: 'refused', code: 'ARTIFACT_INVALID', message })
const succeeds = (): Promise<RequestResult<null>> => Promise.resolve({ outcome: 'value', value: null })

describe('useProseSession', () => {
  it('restores the manuscript to what it held before a failed application, leaving no entry in undo history', async () => {
    const save = vi.fn<() => Promise<RequestResult<null>>>().mockResolvedValueOnce(refused('disk unhappy'))
    const { result } = renderHook(() => useProseSession('First paragraph.', save))

    await act(async () => {
      const saved = await result.current.install('First paragraph. Second paragraph.')
      expect(saved.failed).toBe(true)
    })

    expect(result.current.text).toBe('First paragraph.')

    const { editor } = result.current.manuscript
    if (editor === null) throw new Error('the editor did not mount')
    expect(editor.commands.undo()).toBe(false)
  })
})

describe('usePlainTextSession', () => {
  it('reverses a successful application in one step, restoring exactly the prior text', async () => {
    const { result } = renderHook(() => usePlainTextSession('Premise: two cups.', succeeds))

    await act(async () => {
      await result.current.install('Premise: two cups, one left behind.')
    })
    expect(result.current.text).toBe('Premise: two cups, one left behind.')

    act(() => {
      expect(result.current.reverseApplication()).toBe(true)
    })
    expect(result.current.text).toBe('Premise: two cups.')
  })

  it('has nothing to reverse once an application has already been reversed, or before one was made', () => {
    const { result } = renderHook(() => usePlainTextSession('Premise: two cups.', succeeds))

    act(() => {
      expect(result.current.reverseApplication()).toBe(false)
    })
    expect(result.current.text).toBe('Premise: two cups.')
  })

  it('leaves nothing to reverse once the author types over an applied change', async () => {
    const { result } = renderHook(() => usePlainTextSession('Premise: two cups.', succeeds))

    await act(async () => {
      await result.current.install('Premise: two cups, one left behind.')
    })
    act(() => result.current.setText('Premise: two cups, one left behind, one still full.'))

    act(() => {
      expect(result.current.reverseApplication()).toBe(false)
    })
    expect(result.current.text).toBe('Premise: two cups, one left behind, one still full.')
  })
})
