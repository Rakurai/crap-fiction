import slugify from '@sindresorhus/slugify'
import { nanoid } from 'nanoid'
import { conversationSchema, type Conversation } from '../shared/conversationViews.js'
import { durableContextSchema } from '../shared/durableContext.js'
import type { CastMemberView, PieceDetail, PieceStatus, PieceSummary } from '../shared/pieceViews.js'
import type { RoundSnapshot } from '../shared/roundEvents.js'
import { countWords } from '../shared/storyLength.js'
import type { RoleDefinition } from './model/roles.js'
import type { ModeDescriptor } from './modes.js'
import {
  mostRecentConversationId,
  pieceExists,
  pieceIds,
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

/**
 * #13 "What already stands": the mode's cast is the ceiling, resolved once at
 * the composition root — this surface never widens a piece's room beyond it.
 * An id naming no specialist in that ceiling is refused rather than written,
 * since the room this piece can ever hold does not include it.
 */
export class UnknownCastMemberError extends Error {
  constructor(pieceId: string, memberId: string) {
    super(`piece "${pieceId}" has no specialist "${memberId}" to enable or disable`)
    this.name = 'UnknownCastMemberError'
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
 * CONTEXT "Room": the piece's specialists, each with its static role
 * description and whether it presently sits in the enabled cast. `specialists`
 * is the mode's cast resolved to role definitions — the ceiling this piece's
 * room can ever hold — so a specialist the piece has disabled is still listed,
 * ready to be enabled again.
 */
function castView(specialists: readonly RoleDefinition[], enabled: readonly string[]): readonly CastMemberView[] {
  return specialists.map((role) => ({
    id: role.id,
    displayName: role.displayName,
    roleDescription: role.roleDescription,
    enabled: enabled.includes(role.id),
  }))
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
 *
 * Whether a round is in flight is the room's fact and not this module's, so it
 * is a parameter rather than something read here or left `null` for a caller to
 * overwrite (SPEC "Seams": the room boundary owns the operations the author
 * starts). A caller therefore cannot compose this view without having asked.
 */
export function getPiece(
  workspaceDir: string,
  id: string,
  roundInFlight: RoundSnapshot | null,
  specialists: readonly RoleDefinition[],
): PieceDetail {
  const piece = requirePiece(workspaceDir, id)
  return {
    ...summarize(id, piece),
    draft: piece.draft?.text ?? '',
    // The story context as the author wrote it, sections and all, rather than as
    // a prompt renders it: this is the surface that shows the author what the
    // room is working from, and #18 proposes changes against these entries.
    storyContext: readStoryContext(workspaceDir, id, durableContextSchema) ?? {},
    currentConversationId: mostRecentConversationId(workspaceDir, id) ?? null,
    roundInFlight,
    cast: castView(specialists, piece.metadata.cast),
  }
}

/**
 * CONTEXT "Room"/#13: the author's own act of enabling or disabling a
 * specialist, carrying no rationale and no lifecycle — just the cast the piece
 * now has. `specialists` is the mode's ceiling, checked here so a stray or
 * stale id never widens a piece's room past what its mode admits.
 */
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

/**
 * #19 "Piece lifecycle": retitling and marking a piece finished or abandoned
 * are the same one-lightweight-write shape as #13's cast toggle — carrying no
 * rationale, gating nothing. CONTEXT "Piece": status is the whole of the
 * lifecycle, so nothing here refuses a transition or checks what the piece's
 * status already is.
 */
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
 * CONTEXT "Conversation": starting one is an intention until its first round
 * opens, so this writes nothing — it names the conversation the first round will
 * be written under. The piece is checked all the same, because an id naming no
 * piece must not come back holding a conversation name the author could then
 * send a round to.
 *
 * The name is minted here rather than in the route: which identifiers a piece's
 * artifacts carry is this module's vocabulary, and a route that minted one would
 * be deciding it.
 */
export function startConversation(workspaceDir: string, pieceId: string): { readonly id: string } {
  if (!pieceExists(workspaceDir, pieceId)) throw new PieceNotFoundError(pieceId)
  return { id: nanoid() }
}

/**
 * SPEC "Files"/"Transport": a conversation exists once its first round
 * opens, so an id naming none yet is a stated `ConversationNotFoundError`
 * rather than an empty conversation standing in for one.
 */
export function getConversation(workspaceDir: string, pieceId: string, conversationId: string): Conversation {
  const conversation = readConversation(workspaceDir, pieceId, conversationId, conversationSchema)
  if (conversation === undefined) throw new ConversationNotFoundError(pieceId, conversationId)
  return conversation
}

/**
 * SPEC "Write semantics": the client is the manuscript's only writer, and a draft
 * write is refused for a piece that does not exist rather than creating one — the
 * author creates pieces, and a stray id must not become a story.
 *
 * That one write is in flight at a time is the store's, not this module's: the
 * artifact's writer is where overlapping writes are serialized (CODING_STANDARDS
 * "Persistence"), and a second lock here would be a second owner of the same
 * guarantee.
 */
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
