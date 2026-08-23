import path from 'node:path'
import { z } from 'zod'
import type { Conversation } from '../../shared/conversationViews.js'
import { pieceStatusSchema } from '../../shared/pieceViews.js'
import { resolveWithinRoot } from './containment.js'
import {
  directoryNames,
  fileExists,
  fileModifiedMs,
  fileNames,
  readJsonArtifact,
  readTextArtifact,
  readYamlArtifact,
  readYamlDirectory,
  readYamlFile,
  writeJsonArtifact,
  writeTextArtifact,
  writeYamlArtifact,
} from './yaml.js'

export { PathEscapesRootError } from './containment.js'
export { ShippedDataError, TolerantReadError } from './yaml.js'

/**
 * The persistence boundary's interface. Every entry point here names an
 * artifact SPEC "Files" draws — the settings file, a piece's metadata, a
 * piece's draft, the three kinds of shipped data — and none of them names a
 * path, a file handle, a parsed document or a serializer detail
 * (CODING_STANDARDS "Persistence"). The layout lives here and only here, so a
 * caller asks for a piece's metadata rather than composing `piece.yaml` under a
 * directory it worked out for itself.
 *
 * Containment is part of that ownership rather than a check a caller remembers
 * to make: an id that would escape the workspace reads as an absent artifact,
 * because the boundary refuses to compose a path out of its own root.
 */

/**
 * Whether a value names an absolute location. Platform path semantics are this
 * boundary's vocabulary, so a caller validating a directory the deployment
 * named asks here rather than importing `node:path` to ask it — the question is
 * about a string and composes nothing.
 */
export function isAbsoluteLocation(value: string): boolean {
  return path.isAbsolute(value)
}

// ---------------------------------------------------------------------------
// The settings file
// ---------------------------------------------------------------------------

function settingsFile(dataRoot: string): string {
  return path.join(dataRoot, 'config', 'settings.yaml')
}

/**
 * SPEC "Files": one `settings.yaml` under the data root holds the workspace
 * path, the interface preferences and the model assignments beside each other.
 * Each caller declares the section it owns and reads only that, which is what
 * keeps three unrelated concerns out of one schema and lets a write set one
 * section without reading the others.
 */
export function readSettings<T>(dataRoot: string, section: z.ZodType<T>): T | undefined {
  return readYamlArtifact(settingsFile(dataRoot), section)
}

export async function writeSettings(dataRoot: string, values: Record<string, unknown>): Promise<void> {
  await writeYamlArtifact(settingsFile(dataRoot), values)
}

/**
 * Resolves the directory the author named as their workspace, refusing one
 * that lands outside the data root. A workspace directory is the one path the
 * product above this boundary holds, because the author names it and it is
 * afterwards the root every piece is addressed against — SPEC "Files" holds it
 * as process configuration for that reason. Throws `PathEscapesRootError`.
 */
export function resolveWorkspaceDirectory(dataRoot: string, candidate: string): string {
  return resolveWithinRoot(dataRoot, candidate)
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const pieceMetadataSchema = z.object({
  title: z.string().min(1),
  mode: z.string().min(1),
  status: pieceStatusSchema,
  cast: z.array(z.string().min(1)),
})

export type PieceMetadata = Readonly<z.infer<typeof pieceMetadataSchema>>

export type StoredPiece = {
  readonly metadata: PieceMetadata
  readonly metadataModifiedMs: number
  readonly draft: { readonly text: string; readonly modifiedMs: number } | undefined
}

/**
 * The directory holding one piece's artifacts, or `undefined` when the id does
 * not address a place inside the workspace at all. An id that escapes is not
 * distinguished from one that never existed: a caller learns nothing about the
 * filesystem from a stray id (SPEC "Local exposure").
 */
function pieceDirectory(workspaceDir: string, id: string): string | undefined {
  try {
    return resolveWithinRoot(workspaceDir, id)
  } catch {
    return undefined
  }
}

function pieceMetadataFile(pieceDir: string): string {
  return path.join(pieceDir, 'piece.yaml')
}

function draftFile(pieceDir: string): string {
  return path.join(pieceDir, 'draft.md')
}

/**
 * SPEC "Files": listing pieces is a directory scan rather than a registry — a
 * directory is a piece when it holds a `piece.yaml`, and nothing else about it
 * is required. This is the scan, so no caller asks the boundary what a piece
 * looks like on disk.
 */
export function pieceIds(workspaceDir: string): readonly string[] {
  return directoryNames(workspaceDir).filter((name) =>
    fileExists(pieceMetadataFile(path.join(workspaceDir, name))),
  )
}

export function pieceExists(workspaceDir: string, id: string): boolean {
  const pieceDir = pieceDirectory(workspaceDir, id)
  return pieceDir !== undefined && fileExists(pieceMetadataFile(pieceDir))
}

/**
 * A piece's metadata, its draft when one has been written, and the moment its
 * metadata was last written — read together, so nothing above this boundary
 * needs a second call to learn when a piece with no draft yet last changed.
 * `undefined` is a declared, meaningful absence: no such piece.
 */
export function readPiece(workspaceDir: string, id: string): StoredPiece | undefined {
  const pieceDir = pieceDirectory(workspaceDir, id)
  if (pieceDir === undefined) return undefined

  const metadataFile = pieceMetadataFile(pieceDir)
  const metadata = readYamlArtifact(metadataFile, pieceMetadataSchema)
  if (metadata === undefined) return undefined

  return {
    metadata,
    metadataModifiedMs: fileModifiedMs(metadataFile),
    draft: readTextArtifact(draftFile(pieceDir)),
  }
}

/**
 * Writes a piece's metadata, creating the piece's directory when this is the
 * first write to it — which is how a piece comes into being (SPEC "Files":
 * creation writes `piece.yaml` and nothing else). An id that would escape the
 * workspace is refused here rather than read as an absence: a write that lands
 * nowhere is worse than one that fails.
 */
export async function writePieceMetadata(
  workspaceDir: string,
  id: string,
  metadata: PieceMetadata,
): Promise<void> {
  await writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), { ...metadata })
}

export async function writeDraft(workspaceDir: string, id: string, text: string): Promise<void> {
  await writeTextArtifact(draftFile(resolveWithinRoot(workspaceDir, id)), text)
}

/**
 * SPEC "The round": addressing a specialist that is not enabled is the same
 * durable write to `piece.yaml` as enabling it directly. Only the `cast` path
 * is set, so a piece's title, mode and status survive untouched.
 */
export async function writePieceCast(workspaceDir: string, id: string, cast: readonly string[]): Promise<void> {
  await writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), { cast: [...cast] })
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

const CONVERSATION_SUFFIX = '.json'

function conversationsDirectory(pieceDir: string): string {
  return path.join(pieceDir, 'conversations')
}

function conversationFile(pieceDir: string, conversationId: string): string {
  return path.join(conversationsDirectory(pieceDir), `${conversationId}${CONVERSATION_SUFFIX}`)
}

/**
 * SPEC "Files": one JSON file per conversation. `undefined` is a declared,
 * meaningful absence — a conversation identifier nothing has been written
 * under yet (CONTEXT "Conversation": starting one is an intention until its
 * first round opens).
 */
export function readConversation<T>(
  workspaceDir: string,
  pieceId: string,
  conversationId: string,
  schema: z.ZodType<T>,
): T | undefined {
  const pieceDir = pieceDirectory(workspaceDir, pieceId)
  if (pieceDir === undefined) return undefined
  return readJsonArtifact(conversationFile(pieceDir, conversationId), schema)
}

export async function writeConversation(
  workspaceDir: string,
  pieceId: string,
  conversationId: string,
  value: Conversation,
): Promise<void> {
  const pieceDir = resolveWithinRoot(workspaceDir, pieceId)
  await writeJsonArtifact(conversationFile(pieceDir, conversationId), value)
}

/**
 * SPEC "Files": a conversation's last activity is its last round's, a fact
 * about the file rather than a counter the application maintains — this is
 * that fact for whichever conversation is most recently active, which is the
 * one opening a piece resumes (CONTEXT "Conversation").
 */
export function mostRecentConversationId(workspaceDir: string, pieceId: string): string | undefined {
  const pieceDir = pieceDirectory(workspaceDir, pieceId)
  if (pieceDir === undefined) return undefined

  const dir = conversationsDirectory(pieceDir)
  const names = fileNames(dir, CONVERSATION_SUFFIX)
  if (names.length === 0) return undefined

  const [mostRecent] = names
    .map((name) => ({ id: name.slice(0, -CONVERSATION_SUFFIX.length), modifiedMs: fileModifiedMs(path.join(dir, name)) }))
    .sort((a, b) => b.modifiedMs - a.modifiedMs)

  return mostRecent?.id
}

// ---------------------------------------------------------------------------
// Shipped data
// ---------------------------------------------------------------------------

/**
 * Shipped data travels with the application rather than with the author's
 * work, so it lives beside the source rather than under the data root. Where
 * beside the source is this boundary's fact like any other layout fact: the
 * modules that read modes, roles and the charter state what those files must
 * contain and never where they are.
 */
const SHIPPED_ROOT = path.join(import.meta.dirname, '..')

export function readShippedModes<T>(schema: z.ZodType<T>): readonly T[] {
  return readYamlDirectory(path.join(SHIPPED_ROOT, 'modes'), schema)
}

export function readShippedRoles<T>(schema: z.ZodType<T>): readonly T[] {
  return readYamlDirectory(path.join(SHIPPED_ROOT, 'model', 'roles'), schema)
}

export function readShippedCharter<T>(schema: z.ZodType<T>): T {
  return readYamlFile(path.join(SHIPPED_ROOT, 'model', 'charter.yaml'), schema)
}
