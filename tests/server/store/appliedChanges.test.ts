import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ConversationScope } from '../../../src/server/scope.js'
import { deleteAppliedChange, PieceMetadataStore, readAppliedChanges, writeAppliedChange } from '../../../src/server/store/index.js'
import { appliedChangeSchema, type AppliedChange } from '../../../src/shared/appliedChange.js'

const cutSentence: AppliedChange = {
  id: 'change1',
  content: { kind: 'passages', passages: [{ before: 'Ruth stood looking at them.', after: '' }] },
}

const REWRITE: AppliedChange = { id: 'change2', content: { kind: 'rewrittenWhole' } }
const pieceMetadata = new PieceMetadataStore()

describe('applied changes', () => {
  let dataRoot: string
  let workspaceDir: string
  let scope: ConversationScope

  beforeEach(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
    scope = { kind: 'piece', workspaceDir, pieceId: 'cups', surface: 'draft' }
    await pieceMetadata.write(workspaceDir, 'cups', {
      title: 'Cups',
      mode: 'flash',
      cast: { draft: ['shape'], storyContext: [], authorContext: [] },
    })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports none before anything is applied, and afterwards every change the piece holds, whatever each of them changed', async () => {
    expect(readAppliedChanges(dataRoot, scope, appliedChangeSchema)).toEqual([])

    await writeAppliedChange(dataRoot, scope, cutSentence)
    await writeAppliedChange(dataRoot, scope, REWRITE)

    const changes = readAppliedChanges(dataRoot, scope, appliedChangeSchema)
    expect(changes).toHaveLength(2)
    expect(changes).toEqual(expect.arrayContaining([cutSentence, REWRITE]))
  })

  it('deletes the one change its id names and no other, and reports nothing wrong for a change not there', async () => {
    await writeAppliedChange(dataRoot, scope, cutSentence)
    await writeAppliedChange(dataRoot, scope, REWRITE)

    await deleteAppliedChange(dataRoot, scope, 'change1')

    expect(readAppliedChanges(dataRoot, scope, appliedChangeSchema)).toEqual([REWRITE])
    await expect(deleteAppliedChange(dataRoot, scope, 'never-written')).resolves.toBeUndefined()
  })
})
