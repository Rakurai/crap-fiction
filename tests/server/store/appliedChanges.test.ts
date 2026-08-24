import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readAppliedChanges, writeAppliedChange, writePieceMetadata } from '../../../src/server/store/index.js'
import { appliedChangeSchema, type AppliedChange } from '../../../src/shared/appliedChange.js'

const cutSentence: AppliedChange = {
  id: 'change1',
  roundId: 'r1',
  participantId: 'shape',
  content: { kind: 'passages', passages: [{ before: 'Ruth stood looking at them.', after: '' }] },
}

describe('applied changes', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports none where nothing has ever been applied', () => {
    expect(readAppliedChanges(workspaceDir, 'cups', appliedChangeSchema)).toEqual([])
  })

  it('writes a change and reads it back among the piece\'s changes', async () => {
    await writeAppliedChange(workspaceDir, 'cups', cutSentence)
    expect(readAppliedChanges(workspaceDir, 'cups', appliedChangeSchema)).toEqual([cutSentence])
  })

  it('reads every change a piece holds, one file each', async () => {
    const rewrite: AppliedChange = { id: 'change2', roundId: 'r2', participantId: 'compression', content: { kind: 'rewrittenWhole' } }
    await writeAppliedChange(workspaceDir, 'cups', cutSentence)
    await writeAppliedChange(workspaceDir, 'cups', rewrite)

    const changes = readAppliedChanges(workspaceDir, 'cups', appliedChangeSchema)
    expect(changes).toHaveLength(2)
    expect(changes).toEqual(expect.arrayContaining([cutSentence, rewrite]))
  })
})
