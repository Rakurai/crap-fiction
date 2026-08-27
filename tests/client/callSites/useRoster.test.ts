import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CallSiteAssignmentView } from '../../../src/shared/callSiteViews.js'
import type { RequestResult } from '../../../src/client/request.js'
import { useRoster } from '../../../src/client/useRoster.js'

const SITES: readonly CallSiteAssignmentView[] = [
  { site: 'shape', handle: 'shape', displayName: 'Shape', description: 'x', mark: 'SH', ordinal: 0, assignment: null },
  { site: 'story-editor', handle: 'editor', displayName: 'Story Editor', description: 'y', mark: 'SE', ordinal: null, assignment: null },
  { site: 'apply', handle: null, displayName: 'Apply', description: 'z', mark: null, ordinal: null, assignment: null },
]

function fetchCallSites(): Promise<RequestResult<readonly CallSiteAssignmentView[]>> {
  return Promise.resolve({ outcome: 'value', value: SITES })
}

describe('useRoster', () => {
  it('names a participant by display name and handle, gives an operation call site no handle, and falls back to the id it was asked about', async () => {
    const { result } = renderHook(() => useRoster(fetchCallSites))

    await waitFor(() => expect(result.current.settled).toBe(true))

    expect(result.current.displayName('shape')).toBe('Shape')
    expect(result.current.handle('shape')).toBe('shape')
    expect(result.current.handle('apply')).toBeUndefined()
    expect(result.current.displayName('retired')).toBe('retired')
  })
})
