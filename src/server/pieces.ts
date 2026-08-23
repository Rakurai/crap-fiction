import path from 'node:path'
import slugify from '@sindresorhus/slugify'
import { Mutex } from 'async-mutex'
import { z } from 'zod'
import { pieceStatusSchema, type PieceDetail, type PieceSummary } from '../shared/pieceViews.js'
import { countWords } from '../shared/storyLength.js'
import type { ModeDescriptor } from './modes.js'
import { PathEscapesRootError, resolveWithinRoot } from './paths.js'
import {
  artifactExists,
  artifactModifiedMs,
  readTextArtifact,
  readYamlArtifact,
  subdirectories,
  writeTextArtifact,
  writeYamlArtifact,
} from './store.js'

export class PieceNotFoundError extends Error {
  constructor(id: string) {
    super(`no piece "${id}"`)
    this.name = 'PieceNotFoundError'
  }
}

const pieceMetadataSchema = z.object({
  title: z.string().min(1),
  mode: z.string().min(1),
  status: pieceStatusSchema,
  cast: z.array(z.string().min(1)),
})


function pieceMetadataPath(pieceDir: string): string {
  return path.join(pieceDir, 'piece.yaml')
}

function draftPath(pieceDir: string): string {
  return path.join(pieceDir, 'draft.md')
}

type PieceMetadata = z.infer<typeof pieceMetadataSchema>
type DraftRead = { text: string; modifiedMs: number }

function loadPiece(id: string, pieceDir: string): { metadata: PieceMetadata; draft: DraftRead | undefined } {
  const metadata = readYamlArtifact(pieceMetadataPath(pieceDir), pieceMetadataSchema)
  if (metadata === undefined) {
    throw new PieceNotFoundError(id)
  }
  return { metadata, draft: readTextArtifact(draftPath(pieceDir)) }
}

/**
 * SPEC "Files": a piece's length is its draft's, counted the same way
 * everywhere (`countWords`), and a piece with no draft yet is a piece the
 * author has only named — length 0, not a failure. Its modified time is the
 * draft's when one exists, and `piece.yaml`'s own otherwise, so a
 * just-created piece still has one.
 */
function summarize(id: string, pieceDir: string, metadata: PieceMetadata, draft: DraftRead | undefined): PieceSummary {
  const length = draft === undefined ? 0 : countWords(draft.text)
  const modified = draft === undefined ? artifactModifiedMs(pieceMetadataPath(pieceDir)) : draft.modifiedMs
  return { id, title: metadata.title, mode: metadata.mode, status: metadata.status, length, modified }
}

function existingPieceIds(workspaceDir: string): ReadonlySet<string> {
  return new Set(subdirectories(workspaceDir))
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
 * SPEC "Files"/"HTTP layer": creation writes `piece.yaml` and nothing else —
 * no model call, no draft file — so a piece is creatable with the runtime
 * not even running. The mode's default cast becomes the piece's enabled
 * cast.
 */
export async function createPiece(workspaceDir: string, title: string, mode: ModeDescriptor): Promise<PieceSummary> {
  const id = uniquePieceId(existingPieceIds(workspaceDir), title)
  const pieceDir = path.join(workspaceDir, id)

  await writeYamlArtifact(pieceMetadataPath(pieceDir), {
    title,
    mode: mode.id,
    status: 'drafting',
    cast: mode.cast.map((specialist) => specialist.id),
  })

  const { metadata, draft } = loadPiece(id, pieceDir)
  return summarize(id, pieceDir, metadata, draft)
}

/**
 * SPEC "Files": listing pieces is a directory scan, not a registry — a
 * directory is a piece when it holds a `piece.yaml` and nothing else about
 * it is required.
 */
export function listPieces(workspaceDir: string): readonly PieceSummary[] {
  const pieces = subdirectories(workspaceDir)
    .filter((name) => artifactExists(pieceMetadataPath(path.join(workspaceDir, name))))
    .map((name) => {
      const pieceDir = path.join(workspaceDir, name)
      const { metadata, draft } = loadPiece(name, pieceDir)
      return summarize(name, pieceDir, metadata, draft)
    })

  return pieces.sort((a, b) => b.modified - a.modified)
}

/**
 * The piece directory for an id that must already exist, refusing one that
 * escapes the workspace the same way `getPiece` does: a `PieceNotFoundError`
 * either way, since an author who typed a stray id gets no more information
 * from a path-traversal attempt than from a piece that never existed.
 */
function resolvePieceDir(workspaceDir: string, id: string): string {
  let pieceDir: string
  try {
    pieceDir = resolveWithinRoot(workspaceDir, id)
  } catch (err) {
    if (err instanceof PathEscapesRootError) {
      throw new PieceNotFoundError(id)
    }
    throw err
  }

  if (!artifactExists(pieceMetadataPath(pieceDir))) {
    throw new PieceNotFoundError(id)
  }

  return pieceDir
}

/**
 * SPEC "Transport": opening a piece returns its draft alongside its metadata,
 * unlike the listing, which reports only what a directory scan needs. Reads
 * the draft once, shared between the summary and the draft text.
 */
export function getPiece(workspaceDir: string, id: string): PieceDetail {
  const pieceDir = resolvePieceDir(workspaceDir, id)
  const { metadata, draft } = loadPiece(id, pieceDir)
  return { ...summarize(id, pieceDir, metadata, draft), draft: draft?.text ?? '' }
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
    const pieceDir = resolvePieceDir(workspaceDir, id)
    await this.#lock.runExclusive(() => writeTextArtifact(draftPath(pieceDir), draft))
  }
}
