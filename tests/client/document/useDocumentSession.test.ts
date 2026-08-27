import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RequestResult } from '../../../src/client/request.js'
import { useProseSession } from '../../../src/client/useDocumentSession.js'

const refused = (message: string): RequestResult<null> => ({ outcome: 'refused', code: 'ARTIFACT_INVALID', message })

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
