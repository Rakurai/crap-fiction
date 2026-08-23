import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAssignment, listAssignments, setAssignment } from '../../../src/server/model/assignments.js'

describe('assignments', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-assignments-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports no assignment for a site nobody has assigned', () => {
    expect(getAssignment(dataRoot, 'shape')).toBeUndefined()
  })

  it('reassigning one site reaches the next read without a restart, and leaves another site untouched', async () => {
    await setAssignment(dataRoot, 'shape', 'llama-3')
    await setAssignment(dataRoot, 'story-editor', 'qwen-14b')

    expect(getAssignment(dataRoot, 'shape')).toBe('llama-3')
    expect(getAssignment(dataRoot, 'story-editor')).toBe('qwen-14b')

    await setAssignment(dataRoot, 'shape', 'llama-3-70b')
    expect(getAssignment(dataRoot, 'shape')).toBe('llama-3-70b')
    expect(getAssignment(dataRoot, 'story-editor')).toBe('qwen-14b')
  })

  it('lists every assignment made so far', async () => {
    await setAssignment(dataRoot, 'shape', 'llama-3')
    expect(listAssignments(dataRoot)).toEqual(new Map([['shape', 'llama-3']]))
  })
})
