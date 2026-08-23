import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  PathEscapesRootError,
  TolerantReadError,
  readConversation,
  readPiece,
  readSettings,
  resolveWorkspaceDirectory,
  writeConversation,
  writePieceMetadata,
  writeSettings,
} from '../../../src/server/store/index.js'

/**
 * SPEC "Files"' closed tolerance list and the failures beside it, asserted
 * against the two artifacts the store actually owns rather than against a
 * schema invented for the mechanism: `settings.yaml` and a piece's
 * `piece.yaml`. A store entry point that skipped the tolerant reader would
 * fail one of these.
 */
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

    await writeSettings(dataRoot, { workspace: 'new-path' })

    const text = readFileSync(settingsPath(), 'utf8')
    expect(text).toContain('# author notes')
    expect(text).toContain('unknown-to-schema: kept')
    expect(text).toContain('workspace: new-path')
    expect(text.indexOf('workspace:')).toBeLessThan(text.indexOf('unknown-to-schema:'))
  })

  it('reads an absent optional section as empty rather than as absent', async () => {
    await writeSettings(dataRoot, { workspace: 'my-writing' })

    const schema = z.object({ interfacePreferences: z.object({ theme: z.enum(['light', 'dark']).optional() }).optional() })
    expect(readSettings(dataRoot, schema)).toEqual({ interfacePreferences: {} })
  })

  it('trims surrounding whitespace from a hand-edited string value', async () => {
    mkdirSync(path.dirname(settingsPath()), { recursive: true })
    writeFileSync(settingsPath(), 'workspace: "  my-writing  "\n', 'utf8')

    expect(readSettings(dataRoot, z.object({ workspace: z.string() }))).toEqual({ workspace: 'my-writing' })
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
