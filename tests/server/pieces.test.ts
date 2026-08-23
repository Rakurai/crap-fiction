import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPiece, DraftWriter, getPiece, listPieces, PieceNotFoundError } from '../../src/server/pieces.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { DraftStore } from '../../src/server/store/index.js'

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

  it('opens a piece by its directory id, with an empty draft, no story context and no conversation yet', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)
    const opened = getPiece(workspaceDir, created.id, null)
    expect(opened).toEqual({ ...created, draft: '', storyContext: {}, currentConversationId: null, roundInFlight: null })
  })

  it('opens a piece reporting the story context the author wrote, section by section', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)
    writeFileSync(
      path.join(workspaceDir, created.id, 'story-context.yaml'),
      'Premise:\n  - two cups, one left behind\nPoint of view:\n  - close third, past tense\n',
      'utf8',
    )

    expect(getPiece(workspaceDir, created.id, null).storyContext).toEqual({
      Premise: ['two cups, one left behind'],
      'Point of view': ['close third, past tense'],
    })
  })

  it('opens a piece carrying its draft text', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)
    writeFileSync(path.join(workspaceDir, created.id, 'draft.md'), 'Two small words.', 'utf8')

    const opened = getPiece(workspaceDir, created.id, null)
    expect(opened.draft).toBe('Two small words.')
  })

  it('reports a missing piece as a stated PieceNotFoundError', () => {
    expect(() => getPiece(workspaceDir, 'nothing-here', null)).toThrowError(PieceNotFoundError)
  })

  it('reports an id that escapes the workspace as a stated PieceNotFoundError rather than reading outside it', () => {
    expect(() => getPiece(workspaceDir, '../../etc', null)).toThrowError(PieceNotFoundError)
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

  /**
   * How a draft is written and how overlapping writes are ordered are the store's
   * properties, asserted where the store is (CODING_STANDARDS "Each property is
   * asserted at exactly one boundary"). What is this module's is which pieces may
   * be written to at all.
   */
  function draftWriter(): DraftWriter {
    return new DraftWriter(new DraftStore())
  }

  it('writes an existing piece\'s draft through to the store', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)

    await draftWriter().save(workspaceDir, piece.id, 'Two small words.')

    expect(readFileSync(path.join(workspaceDir, piece.id, 'draft.md'), 'utf8')).toBe('Two small words.')
  })

  it('reports a missing piece as a stated PieceNotFoundError rather than creating one', async () => {
    await expect(draftWriter().save(workspaceDir, 'nothing-here', 'text')).rejects.toThrowError(PieceNotFoundError)
  })

  it('reports an id that escapes the workspace as a stated PieceNotFoundError rather than writing outside it', async () => {
    await expect(draftWriter().save(workspaceDir, '../../etc', 'text')).rejects.toThrowError(PieceNotFoundError)
  })
})
