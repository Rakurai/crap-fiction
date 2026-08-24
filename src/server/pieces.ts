import slugify from '@sindresorhus/slugify'
import { nanoid } from 'nanoid'
import { appliedChangeSchema, type AppliedChange } from '../shared/appliedChange.js'
import type { CaptureSnapshot } from '../shared/captureViews.js'
import { conversationSchema, type Conversation, type ConversationSummary, type ConversationView } from '../shared/conversationViews.js'
import { durableContextSchema } from '../shared/durableContext.js'
import type { CastMemberView, PieceDetail, PieceStatus, PieceSummary } from '../shared/pieceViews.js'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import { countWords } from '../shared/storyLength.js'
import type { RoleDefinition } from './model/roles.js'
import type { ModeDescriptor } from './modes.js'
import {
  conversationActivity,
  deleteAppliedChange,
  deleteConversation as deleteConversationFile,
  mostRecentConversationId,
  pieceExists,
  pieceIds,
  readAppliedChanges,
  readConversation,
  readPiece,
  readStoryContext,
  writePieceCast,
  writePieceDetails,
  writePieceMetadata,
  type DraftStore,
  type StoredPiece,
} from './store/index.js'

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
    displayName: role.displayName,
    roleDescription: role.roleDescription,
    enabled: enabled.includes(role.id),
  }))
}

function openingWords(conversation: Conversation): string | undefined {
  for (const round of conversation.rounds) {
    if (round.message !== undefined) return round.message
  }
  return undefined
}

export function listConversations(workspaceDir: string, pieceId: string): readonly ConversationSummary[] {
  return conversationActivity(workspaceDir, pieceId)
    .map(({ id, modifiedMs }) => {
      const conversation = readConversation(workspaceDir, pieceId, id, conversationSchema)
      const opening = conversation === undefined ? undefined : openingWords(conversation)
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

export function listPieces(workspaceDir: string): readonly PieceSummary[] {
  const pieces = pieceIds(workspaceDir).map((id) => summarize(id, requirePiece(workspaceDir, id)))
  return pieces.sort((a, b) => b.modified - a.modified)
}

export function getPiece(
  workspaceDir: string,
  id: string,
  roundInFlight: RoundSnapshot | null,
  captureInFlight: CaptureSnapshot | null,
  specialists: readonly RoleDefinition[],
): PieceDetail {
  const piece = requirePiece(workspaceDir, id)
  return {
    ...summarize(id, piece),
    draft: piece.draft?.text ?? '',
    storyContext: readStoryContext(workspaceDir, id, durableContextSchema) ?? {},
    currentConversationId: mostRecentConversationId(workspaceDir, id) ?? null,
    conversations: listConversations(workspaceDir, id),
    roundInFlight,
    captureInFlight,
    cast: castView(specialists, piece.metadata.cast),
  }
}

export async function setPieceCast(
  workspaceDir: string,
  id: string,
  specialists: readonly RoleDefinition[],
  cast: readonly string[],
): Promise<readonly CastMemberView[]> {
  requirePiece(workspaceDir, id)
  const ceiling = new Set(specialists.map((role) => role.id))
  const outside = cast.find((memberId) => !ceiling.has(memberId))
  if (outside !== undefined) throw new UnknownCastMemberError(id, outside)

  await writePieceCast(workspaceDir, id, cast)
  return castView(specialists, cast)
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

export function startConversation(workspaceDir: string, pieceId: string): { readonly id: string } {
  if (!pieceExists(workspaceDir, pieceId)) throw new PieceNotFoundError(pieceId)
  return { id: nanoid() }
}

export function getConversation(workspaceDir: string, pieceId: string, conversationId: string): ConversationView {
  const conversation = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)
  if (conversation === undefined) throw new ConversationNotFoundError(pieceId, conversationId)

  const changes = readAppliedChanges(workspaceDir, pieceId, appliedChangeSchema)
  const changesFor = (roundId: string, participantId: string): readonly AppliedChange[] =>
    changes.filter((change) => change.roundId === roundId && change.participantId === participantId)

  return {
    id: conversation.id,
    rounds: conversation.rounds.map((round) => ({
      ...round,
      participants: round.participants.map((participant) => ({
        ...participant,
        appliedChanges: changesFor(round.id, participant.participantId),
      })),
    })),
  }
}

export async function deleteConversation(workspaceDir: string, pieceId: string, conversationId: string): Promise<void> {
  const conversation = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)
  if (conversation === undefined) throw new ConversationNotFoundError(pieceId, conversationId)

  const roundIds = new Set(conversation.rounds.map((round) => round.id))
  const changes = readAppliedChanges(workspaceDir, pieceId, appliedChangeSchema).filter((change) => roundIds.has(change.roundId))
  for (const change of changes) {
    await deleteAppliedChange(workspaceDir, pieceId, change.id)
  }

  // Last: a failure partway through leaves the file that names the changes still readable.
  await deleteConversationFile(workspaceDir, pieceId, conversationId)
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
