import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CallSiteAssignmentView } from '../../../src/shared/callSiteViews.js'
import type { RequestResult } from '../../../src/client/request.js'
import { useRoster } from '../../../src/client/useRoster.js'

const SITES: readonly CallSiteAssignmentView[] = [
  { site: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x', assignment: null },
  { site: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'y', assignment: null },
  { site: 'apply', handle: null, displayName: null, roleDescription: null, assignment: null },
]

function fetchCallSites(): Promise<RequestResult<readonly CallSiteAssignmentView[]>> {
  return Promise.resolve({ outcome: 'value', value: SITES })
}

describe('useRoster', () => {
  it('offers a handle for every participant and none for an operation call site', async () => {
    const { result } = renderHook(() => useRoster(fetchCallSites))

    await waitFor(() => expect(result.current.settled).toBe(true))

    expect(result.current.handles).toEqual([
      { handle: 'shape', displayName: 'Shape' },
      { handle: 'editor', displayName: 'Story Editor' },
    ])
  })
})
