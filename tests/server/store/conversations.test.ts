import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ConversationEntryStore,
  conversationActivity,
  deleteConversation,
  mostRecentConversationId,
  readConversation,
  readConversationEntries,
  TolerantReadError,
  writeConversation,
  writePieceMetadata,
} from '../../../src/server/store/index.js'
import type { ConversationEntry } from '../../../src/shared/conversationEntries.js'
import { conversationSchema, type Conversation } from '../../../src/shared/conversationViews.js'

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
    // Aged explicitly: writing the two in order would rest on the filesystem's timestamp resolution.
    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, 'cups', 'conversations', 'older.json'), past, past)

    await writeConversation(workspaceDir, 'cups', 'newer', { id: 'newer', rounds: [] })

    expect(mostRecentConversationId(workspaceDir, 'cups')).toBe('newer')
  })

  it('reports every conversation a piece holds with its last activity, unordered', async () => {
    await writeConversation(workspaceDir, 'cups', 'c1', { id: 'c1', rounds: [] })
    await writeConversation(workspaceDir, 'cups', 'c2', { id: 'c2', rounds: [] })

    const activity = conversationActivity(workspaceDir, 'cups')
    expect(activity.map((entry) => entry.id)).toEqual(expect.arrayContaining(['c1', 'c2']))
    expect(activity.every((entry) => typeof entry.modifiedMs === 'number')).toBe(true)
  })

  it('reports no conversation activity for a piece that holds none', () => {
    expect(conversationActivity(workspaceDir, 'cups')).toEqual([])
  })

  it('deletes a conversation\'s one file', async () => {
    await writeConversation(workspaceDir, 'cups', 'c1', oneRound)
    const file = path.join(workspaceDir, 'cups', 'conversations', 'c1.json')
    expect(existsSync(file)).toBe(true)

    await deleteConversation(workspaceDir, 'cups', 'c1')

    expect(existsSync(file)).toBe(false)
  })

  it('deletes nothing and reports nothing wrong for a conversation not on disk', async () => {
    await expect(deleteConversation(workspaceDir, 'cups', 'never-written')).resolves.toBeUndefined()
  })
})

describe('ConversationEntryStore.append', () => {
  let workspaceDir: string

  const authorMessage: ConversationEntry = { id: 'e1', kind: 'authorMessage', text: 'does the opening earn its length', audience: [], brought: [] }
  const response: ConversationEntry = {
    id: 'e2',
    kind: 'participantResponse',
    participantId: 'shape',
    causeId: 'e1',
    outcome: 'commentary',
    claim: 'the entry is late',
  }

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports a conversation nothing has appended to yet as a declared absence', () => {
    expect(readConversationEntries(workspaceDir, 'cups', 'c1')).toBeUndefined()
  })

  it('appends the first entry to a conversation that does not exist on disk yet', async () => {
    await new ConversationEntryStore().append(workspaceDir, 'cups', 'c1', authorMessage)

    expect(readConversationEntries(workspaceDir, 'cups', 'c1')).toEqual({ id: 'c1', entries: [authorMessage] })
  })

  it('appends behind what is already there rather than replacing it', async () => {
    const store = new ConversationEntryStore()
    await store.append(workspaceDir, 'cups', 'c1', authorMessage)
    await store.append(workspaceDir, 'cups', 'c1', response)

    expect(readConversationEntries(workspaceDir, 'cups', 'c1')).toEqual({ id: 'c1', entries: [authorMessage, response] })
  })

  it('serializes two appends accepted together, so both entries survive in the order they were accepted', async () => {
    const store = new ConversationEntryStore()

    await Promise.all([store.append(workspaceDir, 'cups', 'c1', authorMessage), store.append(workspaceDir, 'cups', 'c1', response)])

    expect(readConversationEntries(workspaceDir, 'cups', 'c1')).toEqual({ id: 'c1', entries: [authorMessage, response] })
  })

  it('states a failure, rather than tolerating anything, when the JSON does not parse', () => {
    const file = path.join(workspaceDir, 'cups', 'conversations', 'c1.json')
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, 'not json')

    expect(() => readConversationEntries(workspaceDir, 'cups', 'c1')).toThrowError(TolerantReadError)
  })
})
