import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ConversationNotFoundError,
  createPiece,
  deleteConversation,
  DraftWriter,
  getConversation,
  getPiece,
  listConversations,
  listPieces,
  PieceNotFoundError,
  setPieceCast,
  UnknownCastMemberError,
  updatePieceDetails,
} from '../../src/server/pieces.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { ConversationEntryStore, DraftStore, readAppliedChanges, writeAppliedChange } from '../../src/server/store/index.js'
import { appliedChangeSchema, type AppliedChange } from '../../src/shared/appliedChange.js'
import type { ConversationEntry } from '../../src/shared/conversationEntries.js'

const flash: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [
    { id: 'shape', attendsTo: 'x', defect: 'y' },
    { id: 'compression', attendsTo: 'x', defect: 'y' },
  ],
}

const specialists: readonly RoleDefinition[] = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'the shape of it' },
  { id: 'compression', handle: 'comp', displayName: 'Compression', roleDescription: 'what earns its space' },
]

describe('pieces', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('creates a piece from a title alone, with the mode default cast enabled and no draft written', async () => {
    const piece = await createPiece(workspaceDir, 'The Cups', flash)

    expect(piece.id).toBe('the-cups')
    expect(piece.title).toBe('The Cups')
    expect(piece.mode).toBe('flash')
    expect(piece.status).toBe('drafting')
    expect(piece.length).toBe(0)
  })

  it('disambiguates a colliding slug at creation', async () => {
    const first = await createPiece(workspaceDir, 'The Cups', flash)
    const second = await createPiece(workspaceDir, 'The Cups', flash)

    expect(first.id).toBe('the-cups')
    expect(second.id).toBe('the-cups-2')
  })

  it('lists a directory scan showing each piece length and modified time', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const draftFile = path.join(workspaceDir, piece.id, 'draft.md')
    writeFileSync(draftFile, 'Two small words.', 'utf8')

    const listed = listPieces(workspaceDir)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(piece.id)
    expect(listed[0]?.length).toBe(3)
    expect(typeof listed[0]?.modified).toBe('number')
  })

  it('ignores a directory with no piece.yaml', async () => {
    mkdirSync(path.join(workspaceDir, 'not-a-piece'))
    await createPiece(workspaceDir, 'Cups', flash)

    expect(listPieces(workspaceDir)).toHaveLength(1)
  })

  it('orders the listing by most recently modified first', async () => {
    const older = await createPiece(workspaceDir, 'Older', flash)
    const newer = await createPiece(workspaceDir, 'Newer', flash)

    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, older.id, 'piece.yaml'), past, past)

    const listed = listPieces(workspaceDir)
    expect(listed.map((p) => p.id)).toEqual([newer.id, older.id])
  })

  it('opens a piece by its directory id, with an empty draft, no story context and no conversation yet', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)
    const opened = getPiece(workspaceDir, created.id, null, null, specialists)
    expect(opened).toEqual({
      ...created,
      draft: '',
      storyContext: {},
      currentConversationId: null,
      conversations: [],
      conversationActionInFlight: null,
      captureInFlight: null,
      cast: [
        { id: 'shape', displayName: 'Shape', roleDescription: 'the shape of it', enabled: true },
        { id: 'compression', displayName: 'Compression', roleDescription: 'what earns its space', enabled: true },
      ],
    })
  })

  it('opens a piece carrying the draft and the story context the author wrote, section by section', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)
    writeFileSync(path.join(workspaceDir, created.id, 'draft.md'), 'Two small words.', 'utf8')
    writeFileSync(
      path.join(workspaceDir, created.id, 'story-context.yaml'),
      'Premise:\n  - two cups, one left behind\nPoint of view:\n  - close third, past tense\n',
      'utf8',
    )

    const opened = getPiece(workspaceDir, created.id, null, null, specialists)
    expect(opened.draft).toBe('Two small words.')
    expect(opened.storyContext).toEqual({
      Premise: ['two cups, one left behind'],
      'Point of view': ['close third, past tense'],
    })
  })

  /**
   * One claim, held by every entry point: a piece is resolved before anything is read or
   * written, so neither a piece that is absent nor an id reaching past the workspace can
   * make one appear.
   */
  it('refuses every way in to a piece that is not there, or whose id would escape the workspace', async () => {
    for (const id of ['nothing-here', '../../etc']) {
      expect(() => getPiece(workspaceDir, id, null, null, specialists)).toThrowError(PieceNotFoundError)
      await expect(setPieceCast(workspaceDir, id, specialists, ['shape'])).rejects.toThrowError(PieceNotFoundError)
      await expect(updatePieceDetails(workspaceDir, id, { title: 'Anything' })).rejects.toThrowError(PieceNotFoundError)
      await expect(new DraftWriter(new DraftStore()).save(workspaceDir, id, 'text')).rejects.toThrowError(PieceNotFoundError)
    }
  })
})

describe('setPieceCast', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('disables a specialist, reports the cast as it now stands, and makes it eligible again when named once more', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)

    const disabled = await setPieceCast(workspaceDir, created.id, specialists, ['shape'])

    expect(disabled).toEqual([
      { id: 'shape', displayName: 'Shape', roleDescription: 'the shape of it', enabled: true },
      { id: 'compression', displayName: 'Compression', roleDescription: 'what earns its space', enabled: false },
    ])
    expect(getPiece(workspaceDir, created.id, null, null, specialists).cast).toEqual(disabled)

    const reEnabled = await setPieceCast(workspaceDir, created.id, specialists, ['shape', 'compression'])
    expect(reEnabled.find((member) => member.id === 'compression')?.enabled).toBe(true)
  })

  it("never widens the room past the mode's cast: an id outside it is a stated UnknownCastMemberError", async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)

    await expect(setPieceCast(workspaceDir, created.id, specialists, ['shape', 'story-editor'])).rejects.toThrowError(
      UnknownCastMemberError,
    )
  })
})

describe('updatePieceDetails', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('retitles a piece, leaving its mode, status and directory untouched', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)

    const summary = await updatePieceDetails(workspaceDir, created.id, { title: 'The Cups' })

    expect(summary).toMatchObject({ id: 'cups', title: 'The Cups', mode: 'flash', status: 'drafting' })
    expect(getPiece(workspaceDir, 'cups', null, null, specialists).title).toBe('The Cups')
  })

  it('marks a piece finished or abandoned, with no transition it refuses', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash)

    const finished = await updatePieceDetails(workspaceDir, created.id, { status: 'finished' })
    expect(finished.status).toBe('finished')

    const abandoned = await updatePieceDetails(workspaceDir, created.id, { status: 'abandoned' })
    expect(abandoned.status).toBe('abandoned')

    const backToDrafting = await updatePieceDetails(workspaceDir, created.id, { status: 'drafting' })
    expect(backToDrafting.status).toBe('drafting')
  })
})

describe('DraftWriter', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  function draftWriter(): DraftWriter {
    return new DraftWriter(new DraftStore())
  }

  it("writes an existing piece's draft through to the store", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)

    await draftWriter().save(workspaceDir, piece.id, 'Two small words.')

    expect(readFileSync(path.join(workspaceDir, piece.id, 'draft.md'), 'utf8')).toBe('Two small words.')
  })
})

describe('getConversation', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports a conversation nothing has written yet as a stated ConversationNotFoundError', async () => {
    await createPiece(workspaceDir, 'Cups', flash)
    expect(() => getConversation(workspaceDir, 'cups', 'c1')).toThrowError(ConversationNotFoundError)
  })

  it('joins an application onto the change it produced, by identity, and leaves an unapplied response with none', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const store = new ConversationEntryStore()
    const authorMessage: ConversationEntry = { id: 'e1', kind: 'authorMessage', text: 'a message', audience: [], brought: [] }
    const response: ConversationEntry = {
      id: 'e2',
      kind: 'participantResponse',
      participantId: 'shape',
      causeId: 'e1',
      outcome: 'applicableSuggestion',
      claim: 'cut the second paragraph',
    }
    const otherResponse: ConversationEntry = {
      id: 'e3',
      kind: 'participantResponse',
      participantId: 'compression',
      causeId: 'e1',
      outcome: 'commentary',
      claim: 'it holds',
    }
    const application: ConversationEntry = { id: 'e4', kind: 'application', responseId: 'e2', changeId: 'change1' }
    for (const entry of [authorMessage, response, otherResponse, application]) await store.append(workspaceDir, piece.id, 'c1', entry)

    const change: AppliedChange = { id: 'change1', content: { kind: 'passages', passages: [{ before: 'the second paragraph', after: '' }] } }
    await writeAppliedChange(workspaceDir, piece.id, change)

    const conversation = getConversation(workspaceDir, piece.id, 'c1')

    const applicationView = conversation.entries.find((entry) => entry.kind === 'application')
    expect(applicationView).toMatchObject({ responseId: 'e2', changeId: 'change1', change: change.content })
  })

  it('degrades to the application shown without its change when the change file is missing, rather than erroring', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const store = new ConversationEntryStore()
    const application: ConversationEntry = { id: 'e1', kind: 'application', responseId: 'no-such-response', changeId: 'never-written' }
    await store.append(workspaceDir, piece.id, 'c1', application)

    const conversation = getConversation(workspaceDir, piece.id, 'c1')
    expect(conversation.entries[0]).toMatchObject({ kind: 'application', change: undefined })
  })
})

describe('listConversations', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports none for a piece with no conversations', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    expect(listConversations(workspaceDir, piece.id)).toEqual([])
  })

  // Which entry the opening words come from belongs to `shared/conversationEntries.test.ts`.
  it("carries the conversation's opening words onto the summary", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    await new ConversationEntryStore().append(workspaceDir, piece.id, 'c1', {
      id: 'e1',
      kind: 'authorMessage',
      text: 'does the opening earn its length',
      audience: [],
      brought: [],
    })

    const [summary] = listConversations(workspaceDir, piece.id)
    expect(summary).toMatchObject({ id: 'c1', opening: 'does the opening earn its length' })
  })

  it('orders the listing by last activity, most recent first', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const store = new ConversationEntryStore()
    const anyEntry: ConversationEntry = { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] }
    await store.append(workspaceDir, piece.id, 'older', anyEntry)
    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, piece.id, 'conversations', 'older.json'), past, past)
    await store.append(workspaceDir, piece.id, 'newer', anyEntry)

    expect(listConversations(workspaceDir, piece.id).map((c) => c.id)).toEqual(['newer', 'older'])
  })
})

describe('deleteConversation', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('reports a conversation nothing has written yet as a stated ConversationNotFoundError', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    await expect(deleteConversation(workspaceDir, piece.id, 'never-written')).rejects.toThrowError(ConversationNotFoundError)
  })

  it('removes the conversation and the change files its applications name, leaving the rest untouched', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash)
    const store = new ConversationEntryStore()
    await store.append(workspaceDir, piece.id, 'c1', { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] })
    await store.append(workspaceDir, piece.id, 'c1', { id: 'e2', kind: 'application', responseId: 'e1', changeId: 'change1' })
    await store.append(workspaceDir, piece.id, 'c2', { id: 'e1', kind: 'authorMessage', text: 'y', audience: [], brought: [] })

    const ownChange: AppliedChange = { id: 'change1', content: { kind: 'passages', passages: [{ before: 'it', after: '' }] } }
    const unrelatedChange: AppliedChange = { id: 'change2', content: { kind: 'rewrittenWhole' } }
    await writeAppliedChange(workspaceDir, piece.id, ownChange)
    await writeAppliedChange(workspaceDir, piece.id, unrelatedChange)

    await deleteConversation(workspaceDir, piece.id, 'c1')

    expect(() => getConversation(workspaceDir, piece.id, 'c1')).toThrowError(ConversationNotFoundError)
    expect(listConversations(workspaceDir, piece.id).map((c) => c.id)).toEqual(['c2'])
    expect(readAppliedChanges(workspaceDir, piece.id, appliedChangeSchema)).toEqual([unrelatedChange])
  })
})
