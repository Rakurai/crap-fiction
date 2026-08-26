import slugify from '@sindresorhus/slugify'
import { nanoid } from 'nanoid'
import { appliedChangeSchema, type AppliedChange } from '../shared/appliedChange.js'
import { openingWords, type ConversationSummary } from '../shared/conversationEntries.js'
import type { ConversationEntryView, EntryConversationView } from '../shared/conversationEntryViews.js'
import type { CastMemberView, PieceDetail, PieceStatus, PieceSummary, SurfaceDetail } from '../shared/pieceViews.js'
import { countWords } from '../shared/storyLength.js'
import { SURFACE_IDS, type PieceSurfaceId, type SurfaceId } from '../shared/surfaces.js'
import type { RoleDefinition } from './model/roles.js'
import type { ModeDescriptor } from './modes.js'
import { defaultCastFor, specialistsFor } from './room/roster.js'
import { conversationScopeFor, type ConversationScope } from './scope.js'
import {
  conversationActivity,
  deleteAppliedChange,
  deleteConversation as deleteConversationFile,
  mostRecentConversationId,
  pieceExists,
  pieceIds,
  readAppliedChanges,
  readAuthorContext,
  readConversationEntries,
  readPiece,
  readStoryContext,
  writePieceCast,
  writePieceDetails,
  writePieceMetadata,
  type DraftStore,
  type StoredPiece,
} from './store/index.js'

/** The surface every act that changes a piece's own cast reaches; the other two hold their own. */
const OPENED_SURFACE: PieceSurfaceId = 'draft'

function draftScope(workspaceDir: string, pieceId: string): ConversationScope {
  return { kind: 'piece', workspaceDir, pieceId, surface: OPENED_SURFACE }
}

function surfaceScope(workspaceDir: string, pieceId: string, surface: SurfaceId): ConversationScope {
  return conversationScopeFor(workspaceDir, { pieceId, surface })
}

export class PieceNotFoundError extends Error {
  constructor(id: string) {
    super(`no piece "${id}"`)
    this.name = 'PieceNotFoundError'
  }
}

export class ConversationNotFoundError extends Error {
  constructor(pieceId: string, conversationId: string) {
    super(`no conversation "${conversationId}" for piece "${pieceId}"`)
    this.name = 'ConversationNotFoundError'
  }
}

export class UnknownCastMemberError extends Error {
  constructor(pieceId: string, memberId: string) {
    super(`piece "${pieceId}" has no specialist "${memberId}" to enable or disable`)
    this.name = 'UnknownCastMemberError'
  }
}

export class UnknownModeError extends Error {
  constructor(modeId: string) {
    super(`no loaded mode "${modeId}"`)
    this.name = 'UnknownModeError'
  }
}

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

function castView(specialists: readonly RoleDefinition[], enabled: readonly string[]): readonly CastMemberView[] {
  return specialists.map((role) => ({
    id: role.id,
    handle: role.handle,
    displayName: role.displayName,
    description: role.description,
    enabled: enabled.includes(role.id),
  }))
}

export function listConversations(
  dataRoot: string,
  workspaceDir: string,
  pieceId: string,
  surface: SurfaceId = OPENED_SURFACE,
): readonly ConversationSummary[] {
  const scope = surfaceScope(workspaceDir, pieceId, surface)
  return conversationActivity(dataRoot, scope)
    .map(({ id, modifiedMs }) => {
      const conversation = readConversationEntries(dataRoot, scope, id)
      const opening = conversation === undefined ? undefined : openingWords(conversation.entries)
      return { id, opening, lastActivity: modifiedMs }
    })
    .sort((a, b) => b.lastActivity - a.lastActivity)
}

function uniquePieceId(existing: ReadonlySet<string>, title: string): string {
  const base = slugify(title)
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function createPiece(
  workspaceDir: string,
  title: string,
  modeId: string,
  modes: readonly ModeDescriptor[],
  specialists: readonly RoleDefinition[],
): Promise<PieceSummary> {
  if (!modes.some((mode) => mode.id === modeId)) throw new UnknownModeError(modeId)

  const id = uniquePieceId(new Set(pieceIds(workspaceDir)), title)

  await writePieceMetadata(workspaceDir, id, {
    title,
    mode: modeId,
    status: 'drafting',
    cast: {
      draft: [...defaultCastFor(specialists, modeId, 'draft')],
      storyContext: [...defaultCastFor(specialists, modeId, 'storyContext')],
      authorContext: [...defaultCastFor(specialists, modeId, 'authorContext')],
    },
  })

  return summarize(id, requirePiece(workspaceDir, id))
}

export function listPieces(workspaceDir: string): readonly PieceSummary[] {
  const pieces = pieceIds(workspaceDir).map((id) => summarize(id, requirePiece(workspaceDir, id)))
  return pieces.sort((a, b) => b.modified - a.modified)
}

function surfaceText(workspaceDir: string, dataRoot: string, id: string, piece: StoredPiece, surface: SurfaceId): string {
  if (surface === 'draft') return piece.draft?.text ?? ''
  if (surface === 'storyContext') return readStoryContext(workspaceDir, id) ?? ''
  return readAuthorContext(dataRoot) ?? ''
}

function surfaceReferenceSchema(piece: StoredPiece, surface: SurfaceId, modes: readonly ModeDescriptor[], authorContextReference: string): string | null {
  if (surface === 'draft') return null
  if (surface === 'storyContext') return modes.find((mode) => mode.id === piece.metadata.mode)?.storyContextReference ?? ''
  return authorContextReference
}

function surfaceDetail(
  dataRoot: string,
  workspaceDir: string,
  id: string,
  piece: StoredPiece,
  specialists: readonly RoleDefinition[],
  modes: readonly ModeDescriptor[],
  authorContextReference: string,
  surface: SurfaceId,
): SurfaceDetail {
  const available = specialistsFor(specialists, piece.metadata.mode, surface)
  return {
    text: surfaceText(workspaceDir, dataRoot, id, piece, surface),
    referenceSchema: surfaceReferenceSchema(piece, surface, modes, authorContextReference),
    currentConversationId: mostRecentConversationId(dataRoot, surfaceScope(workspaceDir, id, surface)) ?? null,
    conversations: listConversations(dataRoot, workspaceDir, id, surface),
    cast: castView(available, piece.metadata.cast[surface]),
  }
}

export function getPiece(
  dataRoot: string,
  workspaceDir: string,
  id: string,
  specialists: readonly RoleDefinition[],
  storyEditor: RoleDefinition,
  modes: readonly ModeDescriptor[],
  authorContextReference: string,
): PieceDetail {
  const piece = requirePiece(workspaceDir, id)
  const surfaces = Object.fromEntries(
    SURFACE_IDS.map((surface) => [surface, surfaceDetail(dataRoot, workspaceDir, id, piece, specialists, modes, authorContextReference, surface)]),
  ) as PieceDetail['surfaces']
  return {
    ...summarize(id, piece),
    surfaces,
    storyEditor: { handle: storyEditor.handle, displayName: storyEditor.displayName, description: storyEditor.description },
  }
}

export async function setPieceCast(
  workspaceDir: string,
  id: string,
  specialists: readonly RoleDefinition[],
  surface: SurfaceId,
  cast: readonly string[],
): Promise<readonly CastMemberView[]> {
  const piece = requirePiece(workspaceDir, id)
  const available = specialistsFor(specialists, piece.metadata.mode, surface)
  const ceiling = new Set(available.map((role) => role.id))
  const outside = cast.find((memberId) => !ceiling.has(memberId))
  if (outside !== undefined) throw new UnknownCastMemberError(id, outside)

  await writePieceCast(workspaceDir, id, surface, cast)
  return castView(available, cast)
}

export async function updatePieceDetails(
  workspaceDir: string,
  id: string,
  patch: Readonly<{ title?: string; status?: PieceStatus }>,
): Promise<PieceSummary> {
  requirePiece(workspaceDir, id)
  await writePieceDetails(workspaceDir, id, patch)
  return summarize(id, requirePiece(workspaceDir, id))
}

/**
 * What an author may change about a piece in one act. Which of the three arrived, and so which
 * writes it takes, is this module's decision rather than the route's: a change naming nothing is
 * a change, and it writes nothing.
 */
export type PieceChanges = Readonly<{
  title?: string | undefined
  status?: PieceStatus | undefined
  cast?: readonly string[] | undefined
}>

export async function updatePiece(
  workspaceDir: string,
  id: string,
  specialists: readonly RoleDefinition[],
  changes: PieceChanges,
): Promise<void> {
  const { title, status, cast } = changes

  if (title !== undefined || status !== undefined) {
    await updatePieceDetails(workspaceDir, id, { ...(title !== undefined ? { title } : {}), ...(status !== undefined ? { status } : {}) })
  }
  if (cast !== undefined) {
    await setPieceCast(workspaceDir, id, specialists, OPENED_SURFACE, cast)
  }
}

export function startConversation(workspaceDir: string, pieceId: string): { readonly id: string } {
  if (!pieceExists(workspaceDir, pieceId)) throw new PieceNotFoundError(pieceId)
  return { id: nanoid() }
}

export function getConversation(dataRoot: string, workspaceDir: string, pieceId: string, conversationId: string): EntryConversationView {
  const scope = draftScope(workspaceDir, pieceId)
  const conversation = readConversationEntries(dataRoot, scope, conversationId)
  if (conversation === undefined) throw new ConversationNotFoundError(pieceId, conversationId)

  const changes = new Map(readAppliedChanges(dataRoot, scope, appliedChangeSchema).map((change) => [change.id, change]))

  const entries: ConversationEntryView[] = conversation.entries.map((entry) =>
    entry.kind === 'application' ? { ...entry, change: changes.get(entry.changeId)?.content } : entry,
  )

  return { id: conversation.id, entries }
}

export async function deleteConversation(dataRoot: string, workspaceDir: string, pieceId: string, conversationId: string): Promise<void> {
  const scope = draftScope(workspaceDir, pieceId)
  const conversation = readConversationEntries(dataRoot, scope, conversationId)
  if (conversation === undefined) throw new ConversationNotFoundError(pieceId, conversationId)

  const changeIds = conversation.entries.flatMap((entry) => (entry.kind === 'application' ? [entry.changeId] : []))
  for (const changeId of changeIds) {
    await deleteAppliedChange(dataRoot, scope, changeId)
  }

  // Last: a failure partway through leaves the file that names the changes still readable.
  await deleteConversationFile(dataRoot, scope, conversationId)
}

export class DraftWriter {
  readonly #drafts: DraftStore

  constructor(drafts: DraftStore) {
    this.#drafts = drafts
  }

  async save(workspaceDir: string, id: string, draft: string): Promise<void> {
    if (!pieceExists(workspaceDir, id)) throw new PieceNotFoundError(id)
    await this.#drafts.write(workspaceDir, id, draft)
  }
}
