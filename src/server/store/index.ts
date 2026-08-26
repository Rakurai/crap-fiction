import path from 'node:path'
import { Mutex } from 'async-mutex'
import { z } from 'zod'
import type { AppliedChange } from '../../shared/appliedChange.js'
import type { ConversationEntry, EntryConversation } from '../../shared/conversationEntries.js'
import { entryConversationSchema } from '../../shared/conversationEntries.js'
import { pieceStatusSchema } from '../../shared/pieceViews.js'
import type { SurfaceId } from '../../shared/surfaces.js'
import type { ConversationScope } from '../scope.js'
import { resolveWithinRoot } from './containment.js'
import {
  deleteFile,
  directoryNames,
  fileExists,
  fileModifiedMs,
  fileNames,
  readContentDocuments,
  readContentFragmentFile,
  readJsonArtifact,
  readShippedTextFile,
  readTextArtifact,
  readYamlArtifact,
  readYamlFile,
  ShippedDataError,
  writeJsonArtifact,
  writeTextArtifact,
  writeYamlArtifact,
} from './yaml.js'

export { PathEscapesRootError } from './containment.js'
export { ShippedDataError, TolerantReadError } from './yaml.js'

export function isAbsoluteLocation(value: string): boolean {
  return path.isAbsolute(value)
}

function settingsFile(dataRoot: string): string {
  return path.join(dataRoot, 'config', 'settings.yaml')
}

export type SettingsSection = 'workspace' | 'interfacePreferences' | 'modelAssignments'

export function readSettingsSection<T>(dataRoot: string, section: SettingsSection, schema: z.ZodType<T>): T | undefined {
  const settings = readYamlArtifact(settingsFile(dataRoot), z.object({ [section]: schema.optional() }))
  return settings?.[section]
}

export async function writeSettingsSection(dataRoot: string, section: SettingsSection, value: unknown): Promise<void> {
  await writeYamlArtifact(settingsFile(dataRoot), { [section]: value })
}

function authorContextFile(dataRoot: string): string {
  return path.join(dataRoot, 'config', 'author-context.yaml')
}

export function readAuthorContext(dataRoot: string): string | undefined {
  return readTextArtifact(authorContextFile(dataRoot))?.text
}

export async function writeAuthorContext(dataRoot: string, text: string): Promise<void> {
  await writeTextArtifact(authorContextFile(dataRoot), text)
}

export function resolveWorkspaceDirectory(dataRoot: string, candidate: string): string {
  return resolveWithinRoot(dataRoot, candidate)
}

const castBySurfaceSchema = z.object({
  draft: z.array(z.string().min(1)),
  storyContext: z.array(z.string().min(1)),
  authorContext: z.array(z.string().min(1)),
})

export type CastBySurface = Readonly<z.infer<typeof castBySurfaceSchema>>

const pieceMetadataSchema = z.object({
  title: z.string().min(1),
  mode: z.string().min(1),
  status: pieceStatusSchema,
  cast: castBySurfaceSchema,
})

export type PieceMetadata = Readonly<z.infer<typeof pieceMetadataSchema>>

export type StoredPiece = {
  readonly metadata: PieceMetadata
  readonly metadataModifiedMs: number
  readonly draft: { readonly text: string; readonly modifiedMs: number } | undefined
}

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

function storyContextFile(pieceDir: string): string {
  return path.join(pieceDir, 'story-context.yaml')
}

export function readStoryContext(workspaceDir: string, id: string): string | undefined {
  const pieceDir = pieceDirectory(workspaceDir, id)
  if (pieceDir === undefined) return undefined
  return readTextArtifact(storyContextFile(pieceDir))?.text
}

export async function writeStoryContext(workspaceDir: string, id: string, text: string): Promise<void> {
  await writeTextArtifact(storyContextFile(resolveWithinRoot(workspaceDir, id)), text)
}

export function pieceIds(workspaceDir: string): readonly string[] {
  return directoryNames(workspaceDir).filter((name) =>
    fileExists(pieceMetadataFile(path.join(workspaceDir, name))),
  )
}

export function pieceExists(workspaceDir: string, id: string): boolean {
  const pieceDir = pieceDirectory(workspaceDir, id)
  return pieceDir !== undefined && fileExists(pieceMetadataFile(pieceDir))
}

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

export async function writePieceMetadata(
  workspaceDir: string,
  id: string,
  metadata: PieceMetadata,
): Promise<void> {
  await writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), { ...metadata })
}

export class DraftStore {
  readonly #lock = new Mutex()

  async write(workspaceDir: string, id: string, text: string): Promise<void> {
    const file = draftFile(resolveWithinRoot(workspaceDir, id))
    await this.#lock.runExclusive(() => writeTextArtifact(file, text))
  }
}

export async function writePieceCast(workspaceDir: string, id: string, surface: SurfaceId, cast: readonly string[]): Promise<void> {
  await writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), { cast: { [surface]: [...cast] } })
}

export async function writePieceDetails(
  workspaceDir: string,
  id: string,
  patch: Readonly<Partial<Pick<PieceMetadata, 'title' | 'status'>>>,
): Promise<void> {
  // An `undefined` entry is still a key `setPaths` writes, blanking a field the caller did not name.
  const values: Record<string, unknown> = {}
  if (patch.title !== undefined) values.title = patch.title
  if (patch.status !== undefined) values.status = patch.status
  await writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), values)
}

type ScopedNamespace = 'conversations' | 'changes'

/**
 * A conversation scope's own directory: under the piece and its surface, or under the data
 * root's global author-context namespace. The two read/write variants differ only in how they
 * treat an escaping or absent piece — the same asymmetry `pieceDirectory` and
 * `resolveWithinRoot` already carry for every other piece-relative artifact.
 */
function namespaceDirectoryForRead(dataRoot: string, scope: ConversationScope, namespace: ScopedNamespace): string | undefined {
  if (scope.kind === 'global') return path.join(dataRoot, 'author-context', namespace)
  const pieceDir = pieceDirectory(scope.workspaceDir, scope.pieceId)
  return pieceDir === undefined ? undefined : path.join(pieceDir, namespace, scope.surface)
}

function namespaceDirectoryForWrite(dataRoot: string, scope: ConversationScope, namespace: ScopedNamespace): string {
  if (scope.kind === 'global') return path.join(dataRoot, 'author-context', namespace)
  const pieceDir = resolveWithinRoot(scope.workspaceDir, scope.pieceId)
  return path.join(pieceDir, namespace, scope.surface)
}

const CONVERSATION_SUFFIX = '.json'

function conversationFile(dir: string, conversationId: string): string {
  return path.join(dir, `${conversationId}${CONVERSATION_SUFFIX}`)
}

export function conversationActivity(dataRoot: string, scope: ConversationScope): readonly { readonly id: string; readonly modifiedMs: number }[] {
  const dir = namespaceDirectoryForRead(dataRoot, scope, 'conversations')
  if (dir === undefined) return []

  return fileNames(dir, CONVERSATION_SUFFIX).map((name) => ({
    id: name.slice(0, -CONVERSATION_SUFFIX.length),
    modifiedMs: fileModifiedMs(path.join(dir, name)),
  }))
}

export function mostRecentConversationId(dataRoot: string, scope: ConversationScope): string | undefined {
  const [mostRecent] = [...conversationActivity(dataRoot, scope)].sort((a, b) => b.modifiedMs - a.modifiedMs)
  return mostRecent?.id
}

export async function deleteConversation(dataRoot: string, scope: ConversationScope, conversationId: string): Promise<void> {
  const dir = namespaceDirectoryForWrite(dataRoot, scope, 'conversations')
  await deleteFile(conversationFile(dir, conversationId))
}

export function readConversationEntries(dataRoot: string, scope: ConversationScope, conversationId: string): EntryConversation | undefined {
  const dir = namespaceDirectoryForRead(dataRoot, scope, 'conversations')
  if (dir === undefined) return undefined
  return readJsonArtifact(conversationFile(dir, conversationId), entryConversationSchema)
}

export class ConversationEntryStore {
  readonly #lock = new Mutex()

  /** Appending an entry whose id is already on file is a no-op: retrying a write is safe. */
  async append(dataRoot: string, scope: ConversationScope, conversationId: string, entry: ConversationEntry): Promise<void> {
    const dir = namespaceDirectoryForWrite(dataRoot, scope, 'conversations')
    const file = conversationFile(dir, conversationId)
    await this.#lock.runExclusive(async () => {
      const existing = readJsonArtifact(file, entryConversationSchema)
      if (existing?.entries.some((candidate) => candidate.id === entry.id) === true) return
      const next: EntryConversation = { id: conversationId, entries: [...(existing?.entries ?? []), entry] }
      await writeJsonArtifact(file, next)
    })
  }
}

/**
 * Confirming a pending Apply in one call: the applied-change record lands before the entry that
 * references it, so a process loss between the two writes can only leave a change no entry names,
 * never an entry whose change is missing. Each write is independently idempotent, so retrying the
 * whole call is safe.
 */
export async function writeApplication(
  dataRoot: string,
  scope: ConversationScope,
  conversationId: string,
  entries: ConversationEntryStore,
  change: AppliedChange,
  entry: ConversationEntry,
): Promise<void> {
  await writeAppliedChange(dataRoot, scope, change)
  await entries.append(dataRoot, scope, conversationId, entry)
}

const CHANGE_SUFFIX = '.json'

function changeFile(dir: string, changeId: string): string {
  return path.join(dir, `${changeId}${CHANGE_SUFFIX}`)
}

export async function writeAppliedChange(dataRoot: string, scope: ConversationScope, change: AppliedChange): Promise<void> {
  const dir = namespaceDirectoryForWrite(dataRoot, scope, 'changes')
  await writeJsonArtifact(changeFile(dir, change.id), change)
}

export function readAppliedChanges<T>(dataRoot: string, scope: ConversationScope, schema: z.ZodType<T>): readonly T[] {
  const dir = namespaceDirectoryForRead(dataRoot, scope, 'changes')
  if (dir === undefined) return []

  return fileNames(dir, CHANGE_SUFFIX).flatMap((name) => {
    const change = readJsonArtifact(path.join(dir, name), schema)
    return change === undefined ? [] : [change]
  })
}

export async function deleteAppliedChange(dataRoot: string, scope: ConversationScope, changeId: string): Promise<void> {
  const dir = namespaceDirectoryForWrite(dataRoot, scope, 'changes')
  await deleteFile(changeFile(dir, changeId))
}

export function readShippedModes<T>(
  contentRoot: string,
  schema: z.ZodType<T>,
): readonly Readonly<T & { description: string; storyContextReference: string }>[] {
  const dir = path.join(contentRoot, 'modes')
  const modeIds = directoryNames(dir)
  if (modeIds.length === 0) {
    throw new ShippedDataError(dir, '(directory)', 'no data found')
  }

  return modeIds.map((id) => {
    const modeDir = path.join(dir, id)
    const descriptor = readYamlFile(path.join(modeDir, 'mode.yaml'), schema)
    const description = readShippedTextFile(path.join(modeDir, 'description.md'))
    const storyContextReference = readShippedTextFile(path.join(modeDir, 'story-context-reference.md'))
    return { ...descriptor, description, storyContextReference }
  })
}

export function readShippedCharter(contentRoot: string): string {
  return readShippedTextFile(path.join(contentRoot, 'charter.md'))
}

export function readShippedAuthorContextReference(contentRoot: string): string {
  return readShippedTextFile(path.join(contentRoot, 'author-context-reference.md'))
}

export function readShippedParticipants<T>(contentRoot: string, schema: z.ZodType<T>): readonly Readonly<T & { id: string; persona: string }>[] {
  return readContentDocuments(participantsDirectory(contentRoot), schema)
}

export function participantFile(contentRoot: string, id: string): string {
  return path.join(participantsDirectory(contentRoot), `${id}.md`)
}

function participantsDirectory(contentRoot: string): string {
  return path.join(contentRoot, 'participants')
}

export function readShippedFragment<T>(contentRoot: string, kind: string, name: string, schema: z.ZodType<T>): Readonly<T & { body: string }> {
  return readContentFragmentFile(path.join(contentRoot, 'prompts', kind, `${name}.md`), schema)
}
