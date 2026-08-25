import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteAppliedChange, readAppliedChanges, writeAppliedChange, writePieceMetadata } from '../../../src/server/store/index.js'
import { appliedChangeSchema, type AppliedChange } from '../../../src/shared/appliedChange.js'

const cutSentence: AppliedChange = {
  id: 'change1',
  content: { kind: 'passages', passages: [{ before: 'Ruth stood looking at them.', after: '' }] },
}

const REWRITE: AppliedChange = { id: 'change2', content: { kind: 'rewrittenWhole' } }

describe('applied changes', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports none before anything is applied, and afterwards every change the piece holds, whatever each of them changed', async () => {
    expect(readAppliedChanges(workspaceDir, 'cups', appliedChangeSchema)).toEqual([])

    await writeAppliedChange(workspaceDir, 'cups', cutSentence)
    await writeAppliedChange(workspaceDir, 'cups', REWRITE)

    const changes = readAppliedChanges(workspaceDir, 'cups', appliedChangeSchema)
    expect(changes).toHaveLength(2)
    expect(changes).toEqual(expect.arrayContaining([cutSentence, REWRITE]))
  })

  /**
   * A change is held on its own, so a deletion reaches exactly the one named — and a name
   * nothing is held under is nothing to report, not a failure.
   */
  it('deletes the one change its id names and no other, and reports nothing wrong for a change not there', async () => {
    await writeAppliedChange(workspaceDir, 'cups', cutSentence)
    await writeAppliedChange(workspaceDir, 'cups', REWRITE)

    await deleteAppliedChange(workspaceDir, 'cups', 'change1')

    expect(readAppliedChanges(workspaceDir, 'cups', appliedChangeSchema)).toEqual([REWRITE])
    await expect(deleteAppliedChange(workspaceDir, 'cups', 'never-written')).resolves.toBeUndefined()
  })
})
