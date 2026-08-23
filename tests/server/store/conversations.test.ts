import { mkdtempSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mostRecentConversationId,
  readConversation,
  writeConversation,
  writePieceMetadata,
} from '../../../src/server/store/index.js'
import { conversationSchema, type Conversation } from '../../../src/shared/conversationViews.js'

// The record the store is asked to carry is the product's own, declared once and
// imported: a shape retyped here would stop noticing the day the real one grows
// a field.
const oneRound: Conversation = {
  id: 'c1',
  rounds: [
    {
      id: 'r1',
      message: 'does the opening earn its length',
      addressed: [],
      brought: [],
      outcome: 'settled',
      participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'commentary', claim: 'the entry is late' } }],
    },
  ],
}

describe('conversations', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports a conversation nothing has written yet as a declared absence', () => {
    expect(readConversation(workspaceDir, 'cups', 'c1', conversationSchema)).toBeUndefined()
  })

  it('writes a conversation and reads it back', async () => {
    await writeConversation(workspaceDir, 'cups', 'c1', oneRound)
    expect(readConversation(workspaceDir, 'cups', 'c1', conversationSchema)).toEqual(oneRound)
  })

  it('reports no most-recent conversation when none has ever been written', () => {
    expect(mostRecentConversationId(workspaceDir, 'cups')).toBeUndefined()
  })

  it('reports the most recently written conversation as the most recent one', async () => {
    await writeConversation(workspaceDir, 'cups', 'older', { id: 'older', rounds: [] })
    // The one place a test outside the store composes a path the store owns,
    // and it is deliberate: "most recent" is a claim about modification times,
    // and the store offers no way to age a file it has written. Writing the two
    // in order instead would rest on the filesystem's timestamp resolution
    // rather than on anything the store promises.
    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, 'cups', 'conversations', 'older.json'), past, past)

    await writeConversation(workspaceDir, 'cups', 'newer', { id: 'newer', rounds: [] })

    expect(mostRecentConversationId(workspaceDir, 'cups')).toBe('newer')
  })
})
