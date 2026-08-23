import slugify from '@sindresorhus/slugify'
import { Mutex } from 'async-mutex'
import type { PieceDetail, PieceSummary } from '../shared/pieceViews.js'
import { countWords } from '../shared/storyLength.js'
import type { ModeDescriptor } from './modes.js'
import {
  pieceExists,
  pieceIds,
  readPiece,
  writeDraft,
  writePieceMetadata,
  type StoredPiece,
} from './store/index.js'

export class PieceNotFoundError extends Error {
  constructor(id: string) {
    super(`no piece "${id}"`)
    this.name = 'PieceNotFoundError'
  }
}

/**
 * SPEC "Files": a piece's length is its draft's, counted the same way
 * everywhere (`countWords`), and a piece with no draft yet is a piece the
 * author has only named — length 0, not a failure. Its modified time is the
 * draft's when one exists, and its metadata's otherwise, so a just-created
 * piece still has one.
 */
function summarize(id: string, piece: StoredPiece): PieceSummary {
  const { metadata, draft } = piece
  return {
    id,
    title: metadata.title,
    mode: metadata.mode,
    status: metadata.status,
    length: draft === undefined ? 0 : countWords(draft.text),
    modified: draft === undefined ? piece.metadataModifiedMs : draft.modifiedMs,
  }
}

function requirePiece(workspaceDir: string, id: string): StoredPiece {
  const piece = readPiece(workspaceDir, id)
  if (piece === undefined) throw new PieceNotFoundError(id)
  return piece
}

/**
 * SPEC "Files": the piece directory is the piece's identity, derived from
 * the title and disambiguated at creation — never afterwards, since a
 * retitle does not rename the directory.
 */
function uniquePieceId(existing: ReadonlySet<string>, title: string): string {
  const base = slugify(title)
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/**
 * SPEC "Files"/"HTTP layer": creation writes the piece's metadata and nothing
 * else — no model call, no draft — so a piece is creatable with the runtime not
 * even running. The mode's default cast becomes the piece's enabled cast.
 */
export async function createPiece(workspaceDir: string, title: string, mode: ModeDescriptor): Promise<PieceSummary> {
  const id = uniquePieceId(new Set(pieceIds(workspaceDir)), title)

  await writePieceMetadata(workspaceDir, id, {
    title,
    mode: mode.id,
    status: 'drafting',
    cast: mode.cast.map((specialist) => specialist.id),
  })

  return summarize(id, requirePiece(workspaceDir, id))
}

/**
 * SPEC "Files": listing pieces is a directory scan, not a registry — the store
 * reports which ids are pieces and this reports what the listing shows of each.
 */
export function listPieces(workspaceDir: string): readonly PieceSummary[] {
  const pieces = pieceIds(workspaceDir).map((id) => summarize(id, requirePiece(workspaceDir, id)))
  return pieces.sort((a, b) => b.modified - a.modified)
}

/**
 * SPEC "Transport": opening a piece returns its draft alongside its metadata,
 * unlike the listing, which reports only what a directory scan needs. An id
 * that names no piece and an id that would escape the workspace are the same
 * `PieceNotFoundError`, since an author who typed a stray id gets no more
 * information from a path-traversal attempt than from a piece that never
 * existed.
 */
export function getPiece(workspaceDir: string, id: string): PieceDetail {
  const piece = requirePiece(workspaceDir, id)
  return { ...summarize(id, piece), draft: piece.draft?.text ?? '' }
}

/**
 * SPEC "Write semantics": the client is the manuscript's only writer, one
 * write is in flight at a time, and an atomic rename makes a write
 * indivisible but not ordered — two in flight could complete oldest-last and
 * restore prose the author already replaced. A single mutex serializes every
 * draft write through this instance so that cannot happen, regardless of
 * what order the requests arrive in.
 */
export class DraftWriter {
  readonly #lock = new Mutex()

  async save(workspaceDir: string, id: string, draft: string): Promise<void> {
    if (!pieceExists(workspaceDir, id)) throw new PieceNotFoundError(id)
    await this.#lock.runExclusive(() => writeDraft(workspaceDir, id, draft))
  }
}
