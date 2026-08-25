import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAssignment, listAssignments, setAssignment } from '../../../src/server/model/assignments.js'
import { callSites, UnknownCallSiteError } from '../../../src/server/model/callSites.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'

const roles: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'x', persona: 'reasons about x', eligibility: 'cast' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', description: 'y', persona: 'reasons about y', eligibility: 'generalist' },
]
const sites = callSites(roles)

describe('assignments', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-assignments-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports nothing for a site nobody has assigned, and every assignment made so far reaches the next read without a restart', async () => {
    expect(getAssignment(dataRoot, 'shape')).toBeUndefined()
    expect(listAssignments(dataRoot)).toEqual(new Map())

    await setAssignment(dataRoot, sites, 'shape', 'llama-3')
    await setAssignment(dataRoot, sites, 'story-editor', 'qwen-14b')
    // Reassigning one site is the same read, and reaches no other site.
    await setAssignment(dataRoot, sites, 'shape', 'llama-3-70b')

    expect(getAssignment(dataRoot, 'shape')).toBe('llama-3-70b')
    expect(listAssignments(dataRoot)).toEqual(
      new Map([
        ['shape', 'llama-3-70b'],
        ['story-editor', 'qwen-14b'],
      ]),
    )
  })

  it('refuses to assign a model to a call site that does not exist', async () => {
    await expect(setAssignment(dataRoot, sites, 'no-such-site', 'llama-3')).rejects.toThrow(UnknownCallSiteError)
    expect(listAssignments(dataRoot)).toEqual(new Map())
  })
})
