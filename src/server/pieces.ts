import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import slugify from '@sindresorhus/slugify'
import { z } from 'zod'
import { countWords } from '../shared/storyLength.js'
import type { ModeDescriptor } from './modes.js'
import { PathEscapesRootError, resolveWithinRoot } from './paths.js'
import { readYamlArtifact, writeYamlArtifact } from './store.js'

export class PieceNotFoundError extends Error {
  constructor(id: string) {
    super(`no piece "${id}"`)
    this.name = 'PieceNotFoundError'
  }
}

const pieceStatusSchema = z.enum(['drafting', 'finished', 'abandoned'])

const pieceMetadataSchema = z.object({
  title: z.string().min(1),
  mode: z.string().min(1),
  status: pieceStatusSchema,
  cast: z.array(z.string().min(1)).optional(),
})

export type PieceStatus = z.infer<typeof pieceStatusSchema>

export type PieceSummary = Readonly<{
  id: string
  title: string
  mode: string
  status: PieceStatus
  length: number
  modified: number
}>

export type PieceDetail = PieceSummary & Readonly<{ draft: string }>

function pieceMetadataPath(pieceDir: string): string {
  return path.join(pieceDir, 'piece.yaml')
}

function draftPath(pieceDir: string): string {
  return path.join(pieceDir, 'draft.md')
}

/**
 * SPEC "Files": a piece with no draft yet has been only named, so its
 * manuscript is empty rather than a read failure.
 */
function readDraft(pieceDir: string): string {
  const draft = draftPath(pieceDir)
  return existsSync(draft) ? readFileSync(draft, 'utf8') : ''
}

/**
 * SPEC "Files": a piece's length is its draft's, counted the same way
 * everywhere (`countWords`), and a piece with no draft yet is a piece the
 * author has only named — length 0, not a failure. Its modified time is the
 * draft's, falling back to `piece.yaml`'s own so a just-created piece still
 * has one.
 */
function draftStats(pieceDir: string): { length: number; modified: number } {
  const draft = draftPath(pieceDir)
  if (existsSync(draft)) {
    return { length: countWords(readFileSync(draft, 'utf8')), modified: statSync(draft).mtimeMs }
  }
  return { length: 0, modified: statSync(pieceMetadataPath(pieceDir)).mtimeMs }
}

function summarize(id: string, pieceDir: string): PieceSummary {
  const metadata = readYamlArtifact(pieceMetadataPath(pieceDir), pieceMetadataSchema)
  if (metadata === undefined) {
    throw new PieceNotFoundError(id)
  }
  const { length, modified } = draftStats(pieceDir)
  return { id, title: metadata.title, mode: metadata.mode, status: metadata.status, length, modified }
}

function existingPieceIds(workspaceDir: string): ReadonlySet<string> {
  if (!existsSync(workspaceDir)) return new Set()
  return new Set(
    readdirSync(workspaceDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  )
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

  await writeYamlArtifact(pieceMetadataPath(pieceDir), (document) => {
    document.set('title', title)
    document.set('mode', mode.id)
    document.set('status', 'drafting')
    document.set(
      'cast',
      mode.cast.map((specialist) => specialist.id),
    )
  })

  return summarize(id, pieceDir)
}

/**
 * SPEC "Files": listing pieces is a directory scan, not a registry — a
 * directory is a piece when it holds a `piece.yaml` and nothing else about
 * it is required.
 */
export function listPieces(workspaceDir: string): readonly PieceSummary[] {
  if (!existsSync(workspaceDir)) return []

  const pieces = readdirSync(workspaceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(pieceMetadataPath(path.join(workspaceDir, entry.name))))
    .map((entry) => summarize(entry.name, path.join(workspaceDir, entry.name)))

  return pieces.sort((a, b) => b.modified - a.modified)
}

/**
 * SPEC "Transport": opening a piece returns its draft alongside its metadata,
 * unlike the listing, which reports only what a directory scan needs.
 */
export function getPiece(workspaceDir: string, id: string): PieceDetail {
  let pieceDir: string
  try {
    pieceDir = resolveWithinRoot(workspaceDir, id)
  } catch (err) {
    if (err instanceof PathEscapesRootError) {
      throw new PieceNotFoundError(id)
    }
    throw err
  }

  if (!existsSync(pieceMetadataPath(pieceDir))) {
    throw new PieceNotFoundError(id)
  }

  return { ...summarize(id, pieceDir), draft: readDraft(pieceDir) }
}
