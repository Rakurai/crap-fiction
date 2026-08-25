import path from 'node:path'
import { Mutex } from 'async-mutex'
import { z } from 'zod'
import type { AppliedChange } from '../../shared/appliedChange.js'
import type { ConversationEntry, EntryConversation } from '../../shared/conversationEntries.js'
import { entryConversationSchema } from '../../shared/conversationEntries.js'
import { pieceStatusSchema } from '../../shared/pieceViews.js'
import { resolveWithinRoot } from './containment.js'
import {
  deleteFile,
  directoryNames,
  fileExists,
  fileModifiedMs,
  fileNames,
  readContentDocuments,
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

export function readAuthorContext<T>(dataRoot: string, schema: z.ZodType<T>): T | undefined {
  return readYamlArtifact(path.join(dataRoot, 'config', 'author-context.yaml'), schema)
}

export async function writeAuthorContext(dataRoot: string, context: Readonly<Record<string, readonly string[]>>): Promise<void> {
  await writeYamlArtifact(path.join(dataRoot, 'config', 'author-context.yaml'), { ...context })
}

export function resolveWorkspaceDirectory(dataRoot: string, candidate: string): string {
  return resolveWithinRoot(dataRoot, candidate)
}

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

export function readStoryContext<T>(workspaceDir: string, id: string, schema: z.ZodType<T>): T | undefined {
  const pieceDir = pieceDirectory(workspaceDir, id)
  if (pieceDir === undefined) return undefined
  return readYamlArtifact(storyContextFile(pieceDir), schema)
}

export async function writeStoryContext(workspaceDir: string, id: string, context: Readonly<Record<string, readonly string[]>>): Promise<void> {
  await writeYamlArtifact(storyContextFile(resolveWithinRoot(workspaceDir, id)), { ...context })
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

export async function writePieceCast(workspaceDir: string, id: string, cast: readonly string[]): Promise<void> {
  await writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), { cast: [...cast] })
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

const CONVERSATION_SUFFIX = '.json'

function conversationsDirectory(pieceDir: string): string {
  return path.join(pieceDir, 'conversations')
}

function conversationFile(pieceDir: string, conversationId: string): string {
  return path.join(conversationsDirectory(pieceDir), `${conversationId}${CONVERSATION_SUFFIX}`)
}

export function conversationActivity(workspaceDir: string, pieceId: string): readonly { readonly id: string; readonly modifiedMs: number }[] {
  const pieceDir = pieceDirectory(workspaceDir, pieceId)
  if (pieceDir === undefined) return []

  const dir = conversationsDirectory(pieceDir)
  return fileNames(dir, CONVERSATION_SUFFIX).map((name) => ({
    id: name.slice(0, -CONVERSATION_SUFFIX.length),
    modifiedMs: fileModifiedMs(path.join(dir, name)),
  }))
}

export function mostRecentConversationId(workspaceDir: string, pieceId: string): string | undefined {
  const [mostRecent] = [...conversationActivity(workspaceDir, pieceId)].sort((a, b) => b.modifiedMs - a.modifiedMs)
  return mostRecent?.id
}

export async function deleteConversation(workspaceDir: string, pieceId: string, conversationId: string): Promise<void> {
  const pieceDir = resolveWithinRoot(workspaceDir, pieceId)
  await deleteFile(conversationFile(pieceDir, conversationId))
}

export function readConversationEntries(workspaceDir: string, pieceId: string, conversationId: string): EntryConversation | undefined {
  const pieceDir = pieceDirectory(workspaceDir, pieceId)
  if (pieceDir === undefined) return undefined
  return readJsonArtifact(conversationFile(pieceDir, conversationId), entryConversationSchema)
}

export class ConversationEntryStore {
  readonly #lock = new Mutex()

  async append(workspaceDir: string, pieceId: string, conversationId: string, entry: ConversationEntry): Promise<void> {
    const pieceDir = resolveWithinRoot(workspaceDir, pieceId)
    const file = conversationFile(pieceDir, conversationId)
    await this.#lock.runExclusive(async () => {
      const existing = readJsonArtifact(file, entryConversationSchema)
      const next: EntryConversation = { id: conversationId, entries: [...(existing?.entries ?? []), entry] }
      await writeJsonArtifact(file, next)
    })
  }
}

const CHANGE_SUFFIX = '.json'

function changesDirectory(pieceDir: string): string {
  return path.join(pieceDir, 'changes')
}

function changeFile(pieceDir: string, changeId: string): string {
  return path.join(changesDirectory(pieceDir), `${changeId}${CHANGE_SUFFIX}`)
}

export async function writeAppliedChange(workspaceDir: string, pieceId: string, change: AppliedChange): Promise<void> {
  const pieceDir = resolveWithinRoot(workspaceDir, pieceId)
  await writeJsonArtifact(changeFile(pieceDir, change.id), change)
}

export function readAppliedChanges<T>(workspaceDir: string, pieceId: string, schema: z.ZodType<T>): readonly T[] {
  const pieceDir = pieceDirectory(workspaceDir, pieceId)
  if (pieceDir === undefined) return []

  const dir = changesDirectory(pieceDir)
  return fileNames(dir, CHANGE_SUFFIX).flatMap((name) => {
    const change = readJsonArtifact(path.join(dir, name), schema)
    return change === undefined ? [] : [change]
  })
}

export async function deleteAppliedChange(workspaceDir: string, pieceId: string, changeId: string): Promise<void> {
  const pieceDir = resolveWithinRoot(workspaceDir, pieceId)
  await deleteFile(changeFile(pieceDir, changeId))
}

const SHIPPED_ROOT = path.join(import.meta.dirname, '..')

export function readShippedModes<T>(schema: z.ZodType<T>): readonly T[] {
  return readYamlDirectory(path.join(SHIPPED_ROOT, 'modes'), schema)
}

export function readShippedCharter<T>(schema: z.ZodType<T>): T {
  return readYamlFile(path.join(SHIPPED_ROOT, 'model', 'charter.yaml'), schema)
}

export function readShippedParticipants<T>(contentRoot: string, schema: z.ZodType<T>): readonly Readonly<T & { id: string; persona: string }>[] {
  return readContentDocuments(path.join(contentRoot, 'participants'), schema)
}
