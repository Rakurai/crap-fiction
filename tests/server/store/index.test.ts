import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  DraftStore,
  PathEscapesRootError,
  TolerantReadError,
  readAuthorContext,
  readConversation,
  readPiece,
  readSettingsSection,
  readStoryContext,
  resolveWorkspaceDirectory,
  writeAuthorContext,
  writeConversation,
  writePieceCast,
  writePieceDetails,
  writePieceMetadata,
  writeSettingsSection,
  writeStoryContext,
} from '../../../src/server/store/index.js'
import { durableContextSchema } from '../../../src/shared/durableContext.js'

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

  it('trims surrounding whitespace from a hand-edited string value', async () => {
    mkdirSync(path.dirname(settingsPath()), { recursive: true })
    writeFileSync(settingsPath(), 'workspace: "  my-writing  "\n', 'utf8')

    expect(readSettingsSection(dataRoot, 'workspace', z.string())).toBe('my-writing')
  })

  it('sets one section and leaves the others as they stood', async () => {
    await writeSettingsSection(dataRoot, 'workspace', 'my-writing')
    await writeSettingsSection(dataRoot, 'modelAssignments', { shape: 'a-model' })
    await writeSettingsSection(dataRoot, 'interfacePreferences', { theme: 'dark' })

    expect(readSettingsSection(dataRoot, 'workspace', z.string())).toBe('my-writing')
    expect(readSettingsSection(dataRoot, 'modelAssignments', z.record(z.string(), z.string()))).toEqual({ shape: 'a-model' })
  })

  it('refuses a workspace directory outside the data root', () => {
    expect(() => resolveWorkspaceDirectory(dataRoot, '/etc/passwd')).toThrow(PathEscapesRootError)
  })
})

describe("a piece's metadata", () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  function pieceYamlPath(id: string): string {
    return path.join(workspaceDir, id, 'piece.yaml')
  }

  it('reads a hand-edited scalar cast as a one-item list', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
    writeFileSync(pieceYamlPath('cups'), 'title: Cups\nmode: flash\nstatus: drafting\ncast: shape\n', 'utf8')

    expect(readPiece(workspaceDir, 'cups')?.metadata.cast).toEqual(['shape'])
  })

  it('trims surrounding whitespace from a hand-edited title', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
    writeFileSync(pieceYamlPath('cups'), 'title: "  Cups  "\nmode: flash\nstatus: drafting\ncast:\n  - shape\n', 'utf8')

    expect(readPiece(workspaceDir, 'cups')?.metadata.title).toBe('Cups')
  })

  it('states a failure naming the entry when a value is the wrong kind', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
    writeFileSync(pieceYamlPath('cups'), 'title: 42\nmode: flash\nstatus: drafting\ncast:\n  - shape\n', 'utf8')

    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(TolerantReadError)
    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(/title/)
  })

  it('states a failure naming the entry when a required entry is missing', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
    writeFileSync(pieceYamlPath('cups'), 'title: Cups\nmode: flash\nstatus: drafting\n', 'utf8')

    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(TolerantReadError)
    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(/cast/)
  })

  it('states a failure, rather than throwing an unrelated error, when the YAML does not parse', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
    writeFileSync(pieceYamlPath('cups'), ':\n  - this is not: [valid\n', 'utf8')

    expect(() => readPiece(workspaceDir, 'cups')).toThrowError(TolerantReadError)
  })

  it('reads an id that would escape the workspace as a declared absence rather than outside it', () => {
    expect(readPiece(workspaceDir, '../../etc')).toBeUndefined()
  })

  it('refuses to write metadata for an id that would escape the workspace', async () => {
    await expect(
      writePieceMetadata(workspaceDir, '../../etc', { title: 'Cups', mode: 'flash', status: 'drafting', cast: [] }),
    ).rejects.toThrowError(PathEscapesRootError)
  })

  it('reads a piece behind a symlink that resolves outside the workspace as a declared absence', () => {
    const outside = mkdtempSync(path.join(tmpdir(), 'studio-outside-'))
    writeFileSync(path.join(outside, 'piece.yaml'), 'title: Escaped\nmode: flash\nstatus: drafting\ncast: []\n', 'utf8')
    symlinkSync(outside, path.join(workspaceDir, 'escaped'))

    expect(readPiece(workspaceDir, 'escaped')).toBeUndefined()

    rmSync(outside, { recursive: true, force: true })
  })

  it('sets only the cast, leaving title, mode and status untouched', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })

    await writePieceCast(workspaceDir, 'cups', ['shape', 'compression'])

    const metadata = readPiece(workspaceDir, 'cups')?.metadata
    expect(metadata).toEqual({ title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape', 'compression'] })
  })

  it('sets only the title, leaving mode, status and cast untouched', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })

    await writePieceDetails(workspaceDir, 'cups', { title: 'The Cups' })

    const metadata = readPiece(workspaceDir, 'cups')?.metadata
    expect(metadata).toEqual({ title: 'The Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  it('sets only the status, leaving title, mode and cast untouched', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })

    await writePieceDetails(workspaceDir, 'cups', { status: 'finished' })

    const metadata = readPiece(workspaceDir, 'cups')?.metadata
    expect(metadata).toEqual({ title: 'Cups', mode: 'flash', status: 'finished', cast: ['shape'] })
  })
})

describe('the durable contexts', () => {
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

  function handWriteAuthorContext(text: string): void {
    mkdirSync(path.join(dataRoot, 'config'), { recursive: true })
    writeFileSync(path.join(dataRoot, 'config', 'author-context.yaml'), text, 'utf8')
  }

  it('reads an author context nothing has been written to as a declared absence', () => {
    expect(readAuthorContext(dataRoot, durableContextSchema)).toBeUndefined()
  })

  it('reads a piece with no story context as a declared absence rather than as an empty one', async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })

    expect(readStoryContext(workspaceDir, 'cups', durableContextSchema)).toBeUndefined()
  })

  it('reads the sections the author named, with a hand-written scalar entry as a one-item list', () => {
    handWriteAuthorContext('Prose tendencies:\n  - overwrites dialogue tags\nPatterns disliked: rhetorical questions\n')

    expect(readAuthorContext(dataRoot, durableContextSchema)).toEqual({
      'Prose tendencies': ['overwrites dialogue tags'],
      'Patterns disliked': ['rhetorical questions'],
    })
  })

  it('trims surrounding whitespace from a hand-edited entry', () => {
    handWriteAuthorContext('Voice:\n  - "  wry and close  "\n')

    expect(readAuthorContext(dataRoot, durableContextSchema)).toEqual({ Voice: ['wry and close'] })
  })

  it('states a failure naming the section when an entry is the wrong kind', () => {
    handWriteAuthorContext('Voice:\n  - nested:\n      - not prose\n')

    expect(() => readAuthorContext(dataRoot, durableContextSchema)).toThrowError(TolerantReadError)
    expect(() => readAuthorContext(dataRoot, durableContextSchema)).toThrowError(/Voice/)
  })

  it('reads a piece id that would escape the workspace as a declared absence', () => {
    expect(readStoryContext(workspaceDir, '../../etc', durableContextSchema)).toBeUndefined()
  })

  it("keeps a story context's sections through the piece's own writes", async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
    writeFileSync(path.join(workspaceDir, 'cups', 'story-context.yaml'), '# what this is about\nPremise:\n  - two cups, one left behind\n', 'utf8')

    expect(readStoryContext(workspaceDir, 'cups', durableContextSchema)).toEqual({ Premise: ['two cups, one left behind'] })
  })

  it("writes the author context whole, keeping a hand-written comment beside a section a write did not touch", async () => {
    handWriteAuthorContext('# author notes\nVoice:\n  - wry and close\n')

    await writeAuthorContext(dataRoot, { Voice: ['wry and close'], 'Patterns disliked': ['rhetorical questions'] })

    const text = readFileSync(path.join(dataRoot, 'config', 'author-context.yaml'), 'utf8')
    expect(text).toContain('# author notes')
    expect(readAuthorContext(dataRoot, durableContextSchema)).toEqual({
      Voice: ['wry and close'],
      'Patterns disliked': ['rhetorical questions'],
    })
  })

  it("writes a piece's story context the same way", async () => {
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })

    await writeStoryContext(workspaceDir, 'cups', { Premise: ['two cups, one left behind'] })

    expect(readStoryContext(workspaceDir, 'cups', durableContextSchema)).toEqual({ Premise: ['two cups, one left behind'] })
  })

  it('refuses to write a story context for an id that would escape the workspace', async () => {
    await expect(writeStoryContext(workspaceDir, '../../etc', { Premise: ['x'] })).rejects.toThrowError(PathEscapesRootError)
  })
})

describe('a conversation', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  const conversationSchema = z.object({ id: z.string(), rounds: z.array(z.object({ id: z.string() })) })

  it('states a failure, rather than tolerating anything, when the JSON does not parse', async () => {
    await writeConversation(workspaceDir, 'cups', 'c1', { id: 'c1', rounds: [] })
    writeFileSync(path.join(workspaceDir, 'cups', 'conversations', 'c1.json'), '{ not valid json', 'utf8')

    expect(() => readConversation(workspaceDir, 'cups', 'c1', conversationSchema)).toThrowError(TolerantReadError)
  })
})

describe("a piece's draft", () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
    await writePieceMetadata(workspaceDir, 'cups', { title: 'Cups', mode: 'flash', status: 'drafting', cast: ['shape'] })
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

  it('refuses an id that would land outside the workspace rather than writing there', async () => {
    await expect(new DraftStore().write(workspaceDir, '../../escaped', 'text')).rejects.toThrowError(PathEscapesRootError)
  })
})
