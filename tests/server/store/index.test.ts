import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ConversationScope } from '../../../src/server/scope.js'
import {
  ConversationEntryStore,
  conversationActivity,
  DraftStore,
  deleteConversation,
  mostRecentConversationId,
  PathEscapesRootError,
  TolerantReadError,
  readAuthorContext,
  readConversationEntries,
  readPiece,
  readSettingsSection,
  readStoryContext,
  resolveWorkspaceDirectory,
  writeAuthorContext,
  writePieceCast,
  writePieceDetails,
  writePieceMetadata,
  writeSettingsSection,
  writeStoryContext,
} from '../../../src/server/store/index.js'
import type { ConversationEntry } from '../../../src/shared/conversationEntries.js'

const CUPS = { title: 'Cups', mode: 'flash', cast: { draft: ['shape'], storyContext: [], authorContext: [] } }

describe('the settings file', () => {
  let dataRoot: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function settingsPath(): string {
    return path.join(dataRoot, 'config', 'settings.yaml')
  }

  it('keeps a hand-written comment, an unknown key and key order through a write', async () => {
    mkdirSync(path.dirname(settingsPath()), { recursive: true })
    writeFileSync(settingsPath(), '# author notes\nworkspace: old-path\nunknown-to-schema: kept\n', 'utf8')

    await writeSettingsSection(dataRoot, 'workspace', 'new-path')

    const text = readFileSync(settingsPath(), 'utf8')
    expect(text).toContain('# author notes')
    expect(text).toContain('unknown-to-schema: kept')
    expect(text).toContain('workspace: new-path')
    expect(text.indexOf('workspace:')).toBeLessThan(text.indexOf('unknown-to-schema:'))
  })

  it('reads an absent optional section as empty rather than as absent', async () => {
    await writeSettingsSection(dataRoot, 'workspace', 'my-writing')

    const schema = z.object({ theme: z.enum(['light', 'dark']).optional() })
    expect(readSettingsSection(dataRoot, 'interfacePreferences', schema)).toEqual({})
  })

  it('sets one section and leaves the others as they stood', async () => {
    await writeSettingsSection(dataRoot, 'workspace', 'my-writing')
    await writeSettingsSection(dataRoot, 'modelAssignments', { shape: 'a-model' })
    await writeSettingsSection(dataRoot, 'interfacePreferences', { theme: 'dark' })

    expect(readSettingsSection(dataRoot, 'workspace', z.string())).toBe('my-writing')
    expect(readSettingsSection(dataRoot, 'modelAssignments', z.record(z.string(), z.string()))).toEqual({ shape: 'a-model' })
  })
})

/**
 * The reader is tolerant of what a hand editing an author does, and intolerant of what
 * would leave the studio guessing. Each claim below is the reader's, not any one file's,
 * so it is stated once over the readers that share it rather than once per file.
 */
describe('the tolerant reader', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
    await writePieceMetadata(workspaceDir, 'cups', CUPS)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function handWrite(file: string, text: string): void {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text, 'utf8')
  }

  const settingsFile = (): string => path.join(dataRoot, 'config', 'settings.yaml')
  const pieceFile = (): string => path.join(workspaceDir, 'cups', 'piece.yaml')

  it('trims the whitespace an author leaves around a value, wherever a string is read', () => {
    handWrite(settingsFile(), 'workspace: "  my-writing  "\n')
    handWrite(pieceFile(), 'title: "  Cups  "\nmode: flash\ncast:\n  draft:\n    - shape\n  storyContext: []\n  authorContext: []\n')

    expect(readSettingsSection(dataRoot, 'workspace', z.string())).toBe('my-writing')
    expect(readPiece(workspaceDir, 'cups')?.metadata.title).toBe('Cups')
  })

  it('reads a lone value written where a list belongs as a list of that one value', () => {
    handWrite(pieceFile(), 'title: Cups\nmode: flash\ncast:\n  draft: shape\n  storyContext: []\n  authorContext: []\n')

    expect(readPiece(workspaceDir, 'cups')?.metadata.cast.draft).toEqual(['shape'])
  })

  it('states a failure naming the entry it could not make sense of, rather than guessing at it', () => {
    handWrite(pieceFile(), 'title: 42\nmode: flash\ncast:\n  draft:\n    - shape\n  storyContext: []\n  authorContext: []\n')
    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(/title/)

    handWrite(pieceFile(), 'title: Cups\nmode: flash\n')
    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(/cast/)
  })

  it('states a failure, rather than an error from whatever it handed the text to, where the file does not parse', async () => {
    handWrite(pieceFile(), ':\n  - this is not: [valid\n')
    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(TolerantReadError)

    const scope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: 'cups', surface: 'draft' }
    await new ConversationEntryStore().append(dataRoot, scope, 'c1', {
      id: 'e1',
      kind: 'authorMessage',
      text: 'x',
      audience: [],
      brought: [],
    })
    handWrite(path.join(workspaceDir, 'cups', 'conversations', 'draft', 'c1.json'), '{ not valid json')
    expect(() => readConversationEntries(dataRoot, scope, 'c1')).toThrowError(TolerantReadError)
  })
})

/**
 * One claim, held at every path the store resolves: nothing is read from or written to a
 * location outside the root it was given. A read answers with a declared absence and a
 * write refuses, because a read has an absence to report and a write does not.
 */
describe('path containment', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports an escaping id as an absence to every reader and refuses it at every writer', async () => {
    expect(() => resolveWorkspaceDirectory(dataRoot, '/etc/passwd')).toThrow(PathEscapesRootError)

    expect(readPiece(workspaceDir, '../../etc')).toBeUndefined()
    expect(readStoryContext(workspaceDir, '../../etc')).toBeUndefined()

    await expect(writePieceMetadata(workspaceDir, '../../etc', CUPS)).rejects.toThrowError(PathEscapesRootError)
    await expect(writeStoryContext(workspaceDir, '../../etc', 'Premise: x\n')).rejects.toThrowError(PathEscapesRootError)
    await expect(new DraftStore().write(workspaceDir, '../../escaped', 'text')).rejects.toThrowError(PathEscapesRootError)
  })

  it('resolves the link rather than the name, so a piece symlinked outside the workspace is an absence too', () => {
    const outside = mkdtempSync(path.join(tmpdir(), 'studio-outside-'))
    writeFileSync(
      path.join(outside, 'piece.yaml'),
      'title: Escaped\nmode: flash\ncast:\n  draft: []\n  storyContext: []\n  authorContext: []\n',
      'utf8',
    )
    symlinkSync(outside, path.join(workspaceDir, 'escaped'))

    expect(readPiece(workspaceDir, 'escaped')).toBeUndefined()

    rmSync(outside, { recursive: true, force: true })
  })
})

describe("a piece's metadata", () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', CUPS)
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('sets only the entry a write names, leaving the piece as it otherwise stood', async () => {
    await writePieceCast(workspaceDir, 'cups', 'draft', ['shape', 'compression'])
    expect(readPiece(workspaceDir, 'cups')?.metadata).toEqual({ ...CUPS, cast: { ...CUPS.cast, draft: ['shape', 'compression'] } })

    await writePieceDetails(workspaceDir, 'cups', { title: 'The Cups' })
    expect(readPiece(workspaceDir, 'cups')?.metadata).toEqual({ ...CUPS, title: 'The Cups', cast: { ...CUPS.cast, draft: ['shape', 'compression'] } })
  })

  it('holds each surface\'s cast independently, so writing one leaves the others untouched', async () => {
    await writePieceCast(workspaceDir, 'cups', 'storyContext', ['compression'])
    await writePieceCast(workspaceDir, 'cups', 'authorContext', ['interiority'])

    expect(readPiece(workspaceDir, 'cups')?.metadata.cast).toEqual({
      draft: ['shape'],
      storyContext: ['compression'],
      authorContext: ['interiority'],
    })
  })
})

describe('the context documents', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(async () => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
    await writePieceMetadata(workspaceDir, 'cups', CUPS)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reads a context nothing has written to as a declared absence rather than as an empty one', () => {
    expect(readAuthorContext(dataRoot)).toBeUndefined()
    expect(readStoryContext(workspaceDir, 'cups')).toBeUndefined()
  })

  /**
   * Opaque text: whatever the author wrote, including comments and presentation a parser would
   * discard, reads back exactly as written because nothing in the path parses it.
   */
  it('saves and reads back either context byte-identical, comments, presentation and all', async () => {
    const authorText = '# author notes\nVoice:\n  - wry and close\nnot: [valid yaml\n'
    const storyText = '# what this is about\nPremise:   two cups, one left behind\n'

    await writeAuthorContext(dataRoot, authorText)
    await writeStoryContext(workspaceDir, 'cups', storyText)

    expect(readAuthorContext(dataRoot)).toBe(authorText)
    expect(readStoryContext(workspaceDir, 'cups')).toBe(storyText)
  })
})

describe('a conversation', () => {
  let dataRoot: string
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
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
    await writePieceMetadata(workspaceDir, 'cups', CUPS)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function scope(): ConversationScope {
    return { kind: 'piece', workspaceDir, pieceId: 'cups', surface: 'draft' }
  }

  it('reports a conversation nothing has appended to yet as a declared absence', () => {
    expect(readConversationEntries(dataRoot, scope(), 'c1')).toBeUndefined()
    expect(mostRecentConversationId(dataRoot, scope())).toBeUndefined()
    expect(conversationActivity(dataRoot, scope())).toEqual([])
  })

  it('appends the first entry to a conversation not on disk yet, and behind what is there after', async () => {
    const store = new ConversationEntryStore()

    await store.append(dataRoot, scope(), 'c1', authorMessage)
    expect(readConversationEntries(dataRoot, scope(), 'c1')).toEqual({ id: 'c1', entries: [authorMessage] })

    await store.append(dataRoot, scope(), 'c1', response)
    expect(readConversationEntries(dataRoot, scope(), 'c1')).toEqual({ id: 'c1', entries: [authorMessage, response] })
  })

  it('serializes two appends accepted together, so both entries survive in the order they were accepted', async () => {
    const store = new ConversationEntryStore()

    await Promise.all([store.append(dataRoot, scope(), 'c1', authorMessage), store.append(dataRoot, scope(), 'c1', response)])

    expect(readConversationEntries(dataRoot, scope(), 'c1')).toEqual({ id: 'c1', entries: [authorMessage, response] })
  })

  it('reports every conversation a piece holds with its last activity, and the most recently written one as the most recent', async () => {
    const store = new ConversationEntryStore()
    await store.append(dataRoot, scope(), 'older', authorMessage)
    // Aged explicitly: writing the two in order would rest on the filesystem's timestamp resolution.
    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, 'cups', 'conversations', 'draft', 'older.json'), past, past)
    await store.append(dataRoot, scope(), 'newer', authorMessage)

    expect(mostRecentConversationId(dataRoot, scope())).toBe('newer')
    const activity = conversationActivity(dataRoot, scope())
    expect(activity.map((entry) => entry.id)).toEqual(expect.arrayContaining(['older', 'newer']))
    expect(activity.every((entry) => typeof entry.modifiedMs === 'number')).toBe(true)
  })

  it("deletes a conversation's one file, and reports nothing wrong for one that was never written", async () => {
    await new ConversationEntryStore().append(dataRoot, scope(), 'c1', authorMessage)
    const file = path.join(workspaceDir, 'cups', 'conversations', 'draft', 'c1.json')

    await deleteConversation(dataRoot, scope(), 'c1')
    expect(existsSync(file)).toBe(false)

    await expect(deleteConversation(dataRoot, scope(), 'never-written')).resolves.toBeUndefined()
  })

  it('cannot reach a draft conversation through the story-context scope of the same piece', async () => {
    await new ConversationEntryStore().append(dataRoot, scope(), 'c1', authorMessage)

    const storyContextScope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: 'cups', surface: 'storyContext' }
    expect(readConversationEntries(dataRoot, storyContextScope, 'c1')).toBeUndefined()
    expect(readConversationEntries(dataRoot, scope(), 'c1')).toBeDefined()
  })

  it('resolves an author-context conversation under the data root, untouched by which workspace is selected', async () => {
    const globalScope: ConversationScope = { kind: 'global' }
    await new ConversationEntryStore().append(dataRoot, globalScope, 'c1', authorMessage)

    expect(readConversationEntries(dataRoot, globalScope, 'c1')).toEqual({ id: 'c1', entries: [authorMessage] })
    expect(existsSync(path.join(dataRoot, 'author-context', 'conversations', 'c1.json'))).toBe(true)
    expect(existsSync(path.join(workspaceDir, 'cups', 'conversations'))).toBe(false)

    // A second workspace under the same data root reaches the identical global conversation.
    const otherWorkspace = path.join(dataRoot, 'another-workspace')
    mkdirSync(otherWorkspace, { recursive: true })
    expect(readConversationEntries(dataRoot, globalScope, 'c1')).toEqual({ id: 'c1', entries: [authorMessage] })
  })
})

describe("a piece's draft", () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', CUPS)
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('lands as Markdown beside the piece it belongs to', async () => {
    await new DraftStore().write(workspaceDir, 'cups', 'Two small words.')

    expect(readFileSync(path.join(workspaceDir, 'cups', 'draft.md'), 'utf8')).toBe('Two small words.')
  })

  it('serializes overlapping writes, so the one that started last is the one left on disk', async () => {
    const drafts = new DraftStore()

    await Promise.all([drafts.write(workspaceDir, 'cups', 'first'), drafts.write(workspaceDir, 'cups', 'second')])

    expect(readFileSync(path.join(workspaceDir, 'cups', 'draft.md'), 'utf8')).toBe('second')
  })
})
