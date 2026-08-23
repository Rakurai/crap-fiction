import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPiece, DraftWriter, getPiece, listPieces, PieceNotFoundError } from '../../src/server/pieces.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { TolerantReadError } from '../../src/server/store/index.js'

const flash: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [
    { id: 'shape', attendsTo: 'x', defect: 'y' },
    { id: 'compression', attendsTo: 'x', defect: 'y' },
  ],
}

describe('pieces', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('creates a piece from a title alone, with the mode default cast enabled and no draft written', async () => {
    const piece = await createPiece(workspaceDir, 'The Cups', flash)

    expect(piece.id).toBe('the-cups')
    expect(piece.title).toBe('The Cups')
    expect(piece.mode).toBe('flash')
    expect(piece.status).toBe('drafting')
    expect(piece.length).toBe(0)

    const text = readFileSync(path.join(workspaceDir, 'the-cups', 'piece.yaml'), 'utf8')
    expect(text).toContain('title: The Cups')
    expect(text).toContain('mode: flash')
    expect(text).toContain('status: drafting')
    expect(text).toContain('shape')
    expect(text).toContain('compression')
  })

  it('disambiguates a colliding slug at creation', async () => {
    const first = await createPiece(workspaceDir, 'The Cups', flash)
    const second = await createPiece(workspaceDir, 'The Cups', flash)

    expect(first.id).toBe('the-cups')
    expect(second.id).toBe('the-cups-2')
  })

  it('lists a directory scan showing each piece length and modified time', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const draftFile = path.join(workspaceDir, piece.id, 'draft.md')
    writeFileSync(draftFile, 'Two small words.', 'utf8')

    const listed = listPieces(workspaceDir)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(piece.id)
    expect(listed[0]?.length).toBe(3)
    expect(typeof listed[0]?.modified).toBe('number')
  })

  it('counts story length with word boundaries rather than a naive character or whitespace count', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    writeFileSync(path.join(workspaceDir, piece.id, 'draft.md'), "It isn't over, not by half.", 'utf8')

    const listed = listPieces(workspaceDir)
    expect(listed[0]?.length).toBe(6)
  })

  it('ignores a directory with no piece.yaml', async () => {
    mkdirSync(path.join(workspaceDir, 'not-a-piece'))
    await createPiece(workspaceDir, 'Cups', flash)

    expect(listPieces(workspaceDir)).toHaveLength(1)
  })

  it('orders the listing by most recently modified first', async () => {
    const older = await createPiece(workspaceDir, 'Older', flash)
    const newer = await createPiece(workspaceDir, 'Newer', flash)

    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, older.id, 'piece.yaml'), past, past)

    const listed = listPieces(workspaceDir)
    expect(listed.map((p) => p.id)).toEqual([newer.id, older.id])
  })

  it('opens a piece by its directory id, with an empty draft and no conversation yet', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)
    const opened = getPiece(workspaceDir, created.id)
    expect(opened).toEqual({ ...created, draft: '', currentConversationId: null, roundInFlight: null })
  })

  it('opens a piece carrying its draft text', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)
    writeFileSync(path.join(workspaceDir, created.id, 'draft.md'), 'Two small words.', 'utf8')

    const opened = getPiece(workspaceDir, created.id)
    expect(opened.draft).toBe('Two small words.')
  })

  it('reports a missing piece as a stated PieceNotFoundError', () => {
    expect(() => getPiece(workspaceDir, 'nothing-here')).toThrowError(PieceNotFoundError)
  })

  it('reports an id that escapes the workspace as a stated PieceNotFoundError rather than reading outside it', () => {
    expect(() => getPiece(workspaceDir, '../../etc')).toThrowError(PieceNotFoundError)
  })

  it('reports a piece.yaml with no enabled cast as a stated failure naming the entry', () => {
    mkdirSync(path.join(workspaceDir, 'cups'), { recursive: true })
    writeFileSync(path.join(workspaceDir, 'cups', 'piece.yaml'), 'title: Cups\nmode: flash\nstatus: drafting\n', 'utf8')

    expect(() => getPiece(workspaceDir, 'cups')).toThrowError(TolerantReadError)
    expect(() => getPiece(workspaceDir, 'cups')).toThrowError(/cast/)
  })
})

describe('DraftWriter', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('writes the draft to disk as Markdown', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const writer = new DraftWriter()

    await writer.save(workspaceDir, piece.id, 'Two small words.')

    expect(readFileSync(path.join(workspaceDir, piece.id, 'draft.md'), 'utf8')).toBe('Two small words.')
  })

  it('reports a missing piece as a stated PieceNotFoundError rather than creating one', async () => {
    const writer = new DraftWriter()
    await expect(writer.save(workspaceDir, 'nothing-here', 'text')).rejects.toThrowError(PieceNotFoundError)
  })

  it('reports an id that escapes the workspace as a stated PieceNotFoundError rather than writing outside it', async () => {
    const writer = new DraftWriter()
    await expect(writer.save(workspaceDir, '../../etc', 'text')).rejects.toThrowError(PieceNotFoundError)
  })

  it('serializes overlapping writes so the last one to start is the one left on disk', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const writer = new DraftWriter()

    await Promise.all([writer.save(workspaceDir, piece.id, 'first'), writer.save(workspaceDir, piece.id, 'second')])

    expect(readFileSync(path.join(workspaceDir, piece.id, 'draft.md'), 'utf8')).toBe('second')
  })
})
