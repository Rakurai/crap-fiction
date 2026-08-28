import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CallSiteAssignmentView } from '../../../src/shared/callSiteViews.js'
import type { RequestResult } from '../../../src/client/request.js'
import { useRoster, type RosterViewModel } from '../../../src/client/useRoster.js'

function ready(roster: RosterViewModel): Extract<RosterViewModel, { kind: 'ready' }> {
  if (roster.kind !== 'ready') throw new Error(`expected a ready roster, got "${roster.kind}"`)
  return roster
}

const SITES: readonly CallSiteAssignmentView[] = [
  { site: 'shape', handle: 'shape', displayName: 'Shape', description: 'x', mark: 'SH', ordinal: 0, assignment: null },
  { site: 'story-editor', handle: 'editor', displayName: 'Story Editor', description: 'y', mark: 'SE', ordinal: null, assignment: null },
  { site: 'apply', handle: null, displayName: 'Apply', description: 'z', mark: null, ordinal: null, assignment: null },
]

function fetchCallSites(): Promise<RequestResult<readonly CallSiteAssignmentView[]>> {
  return Promise.resolve({ outcome: 'value', value: SITES })
}

function fetchFailingCallSites(): Promise<RequestResult<readonly CallSiteAssignmentView[]>> {
  return Promise.resolve({ outcome: 'unreachable', message: 'could not reach the server' })
}

describe('useRoster', () => {
  it('names a participant by display name and handle, and gives an operation call site no handle', async () => {
    const { result } = renderHook(() => useRoster(fetchCallSites))

    await waitFor(() => expect(result.current.kind).toBe('ready'))

    const { identify } = ready(result.current)
    expect(identify('shape')).toEqual({ displayName: 'Shape', handle: 'shape', mark: 'SH', ordinal: 0 })
    expect(identify('apply')).toEqual({ displayName: 'Apply', handle: undefined, mark: null, ordinal: null })
  })

  it('does not fall back to the raw id for a participant the loaded roster does not name', async () => {
    const { result } = renderHook(() => useRoster(fetchCallSites))

    await waitFor(() => expect(result.current.kind).toBe('ready'))

    const { identify } = ready(result.current)
    expect(identify('retired')).toEqual({ displayName: 'Unknown participant', handle: undefined, mark: null, ordinal: null })
  })

  it('surfaces a refused or unreachable read as its own state rather than an empty, settled roster', async () => {
    const { result } = renderHook(() => useRoster(fetchFailingCallSites))

    await waitFor(() => expect(result.current.kind).toBe('error'))

    expect(result.current).toEqual({ kind: 'error', message: 'could not reach the server' })
  })
})
