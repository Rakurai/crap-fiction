import path from 'node:path'
import { Mutex } from 'async-mutex'
import { z } from 'zod'
import { appliedChangeSchema, type AppliedChange } from '../../shared/appliedChange.js'
import type { ConversationEntry, EntryConversation } from '../../shared/conversationEntries.js'
import { entryConversationSchema } from '../../shared/conversationEntries.js'
import type { SurfaceId } from '../../shared/surfaces.js'
import type { ModelTraceRecord } from '../model/types.js'
import type { ConversationScope } from '../scope.js'
import { PathEscapesRootError, resolveWithinRoot } from './containment.js'
import {
  deleteFile,
  directoryExists,
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
export { ArtifactWriteRefusedError, ShippedDataError, TolerantReadError } from './yaml.js'

export function isAbsoluteLocation(value: string): boolean {
  return path.isAbsolute(value)
}

export function isExistingDirectory(value: string): boolean {
  return directoryExists(value)
}

export function settingsFile(dataRoot: string): string {
  return path.join(dataRoot, 'config', 'settings.yaml')
}

export type SettingsSection = 'workspace' | 'interfacePreferences' | 'modelAssignments'

export function readSettingsSection<T>(dataRoot: string, section: SettingsSection, schema: z.ZodType<T>): T | undefined {
  const settings = readYamlArtifact(settingsFile(dataRoot), z.object({ [section]: schema.optional() }))
  return settings?.[section]
}

export class SettingsStore {
  readonly #lock = new Mutex()

  async writeSection<T>(dataRoot: string, section: SettingsSection, value: T, schema: z.ZodType<T>): Promise<void> {
    await this.#lock.runExclusive(() =>
      writeYamlArtifact(settingsFile(dataRoot), { [section]: value }, z.object({ [section]: schema })),
    )
  }
}

const CONFIG_DIR = 'config'
const DRAFT_FILE = 'draft.md'
const STORY_CONTEXT_FILE = 'story-context.yaml'
const AUTHOR_CONTEXT_FILE = 'author-context.yaml'

export const SURFACE_LOCATIONS: Readonly<Record<SurfaceId, string>> = {
  draft: DRAFT_FILE,
  storyContext: STORY_CONTEXT_FILE,
  authorContext: path.posix.join(CONFIG_DIR, AUTHOR_CONTEXT_FILE),
}

function authorContextFile(dataRoot: string): string {
  return path.join(dataRoot, CONFIG_DIR, AUTHOR_CONTEXT_FILE)
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
  } catch (err) {
    if (err instanceof PathEscapesRootError) return undefined
    throw err
  }
}

function pieceMetadataFile(pieceDir: string): string {
  return path.join(pieceDir, 'piece.yaml')
}

function draftFile(pieceDir: string): string {
  return path.join(pieceDir, DRAFT_FILE)
}

function storyContextFile(pieceDir: string): string {
  return path.join(pieceDir, STORY_CONTEXT_FILE)
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

export class PieceMetadataStore {
  readonly #lock = new Mutex()

  async write(workspaceDir: string, id: string, metadata: PieceMetadata): Promise<void> {
    await this.#lock.runExclusive(() =>
      writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), { ...metadata }, pieceMetadataSchema),
    )
  }

  async writeCast(workspaceDir: string, id: string, surface: SurfaceId, cast: readonly string[]): Promise<void> {
    await this.#lock.runExclusive(() =>
      writeYamlArtifact(
        pieceMetadataFile(resolveWithinRoot(workspaceDir, id)),
        { cast: { [surface]: [...cast] } },
        pieceMetadataSchema,
      ),
    )
  }

  async writeDetails(workspaceDir: string, id: string, patch: Readonly<Partial<Pick<PieceMetadata, 'title'>>>): Promise<void> {
    const values: Record<string, unknown> = {}
    if (patch.title !== undefined) values.title = patch.title
    await this.#lock.runExclusive(() =>
      writeYamlArtifact(pieceMetadataFile(resolveWithinRoot(workspaceDir, id)), values, pieceMetadataSchema),
    )
  }
}

export class DraftStore {
  readonly #lock = new Mutex()

  async write(workspaceDir: string, id: string, text: string): Promise<void> {
    const file = draftFile(resolveWithinRoot(workspaceDir, id))
    await this.#lock.runExclusive(() => writeTextArtifact(file, text))
  }
}

export class StoryContextStore {
  readonly #lock = new Mutex()

  async write(workspaceDir: string, id: string, text: string): Promise<void> {
    await this.#lock.runExclusive(() => writeStoryContext(workspaceDir, id, text))
  }
}

export class AuthorContextStore {
  readonly #lock = new Mutex()

  async write(dataRoot: string, text: string): Promise<void> {
    await this.#lock.runExclusive(() => writeAuthorContext(dataRoot, text))
  }
}

type ScopedNamespace = 'conversations' | 'changes'

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

  async append(dataRoot: string, scope: ConversationScope, conversationId: string, entry: ConversationEntry): Promise<void> {
    const dir = namespaceDirectoryForWrite(dataRoot, scope, 'conversations')
    const file = conversationFile(dir, conversationId)
    await this.#lock.runExclusive(async () => {
      const existing = readJsonArtifact(file, entryConversationSchema)
      if (existing?.entries.some((candidate) => candidate.id === entry.id) === true) return
      const next: EntryConversation = { id: conversationId, entries: [...(existing?.entries ?? []), entry] }
      await writeJsonArtifact(file, next, entryConversationSchema)
    })
  }
}

export async function writeDispatchCause(
  entries: ConversationEntryStore,
  pieceMetadata: PieceMetadataStore,
  dataRoot: string,
  scope: ConversationScope,
  conversationId: string,
  cause: ConversationEntry,
  cast: Readonly<{ workspaceDir: string; pieceId: string; surface: SurfaceId; members: readonly string[] }> | undefined,
): Promise<void> {
  await entries.append(dataRoot, scope, conversationId, cause)
  if (cast !== undefined) await pieceMetadata.writeCast(cast.workspaceDir, cast.pieceId, cast.surface, cast.members)
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
  await writeJsonArtifact(changeFile(dir, change.id), change, appliedChangeSchema)
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

const TRACES_DIR = 'traces'

function traceFile(dataRoot: string, at: number, site: string): string {
  const instant = new Date(at).toISOString().replaceAll(':', '-')
  return path.join(dataRoot, TRACES_DIR, `${instant}-${site}.md`)
}

function reportedCount(count: number | undefined): string {
  return count === undefined ? 'the runtime did not report one' : String(count)
}

function traceText(record: ModelTraceRecord): string {
  return [
    `# ${record.site}, attempt ${record.attempt}`,
    '',
    `model: ${record.assignment}`,
    `read as: ${record.reading}`,
    `runtime stop reason: ${record.runtimeStopReason}`,
    `prompt tokens: ${reportedCount(record.promptTokens)}`,
    `predicted tokens: ${reportedCount(record.predictedTokens)}`,
    '',
    ...record.turns.flatMap((turn) => [`## ${turn.role}`, '', turn.content, '']),
    '## Returned',
    '',
    record.returned,
    '',
  ].join('\n')
}

export async function writeModelTrace(dataRoot: string, at: number, record: ModelTraceRecord): Promise<void> {
  await writeTextArtifact(traceFile(dataRoot, at, record.site), traceText(record))
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
    const storyContextReference = readShippedTextFile(path.join(modeDir, 'story-context.yaml'))
    return { ...descriptor, description, storyContextReference }
  })
}

export function readShippedCharter(contentRoot: string): string {
  return readShippedTextFile(path.join(contentRoot, 'charter.md'))
}

export function readShippedAuthorContextReference(contentRoot: string): string {
  return readShippedTextFile(path.join(contentRoot, 'author-context.yaml'))
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
