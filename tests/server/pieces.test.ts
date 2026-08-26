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
  UnknownModeError,
  updatePieceDetails,
} from '../../src/server/pieces.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { ConversationEntryStore, DraftStore, readAppliedChanges, writeAppliedChange } from '../../src/server/store/index.js'
import type { ConversationScope } from '../../src/server/scope.js'
import { appliedChangeSchema, type AppliedChange } from '../../src/shared/appliedChange.js'
import type { ConversationEntry } from '../../src/shared/conversationEntries.js'

const flash: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in one sitting.',
  storyContextReference: 'Sections, each holding entries.',
}

const epic: ModeDescriptor = {
  id: 'epic',
  displayName: 'Epic',
  description: 'A piece read over several sittings.',
  storyContextReference: 'Sections, each holding entries.',
}

const specialists: readonly RoleDefinition[] = [
  {
    id: 'shape',
    handle: 'shape',
    displayName: 'Shape',
    description: 'the shape of it',
    persona: 'reasons about the shape of it',
    eligibility: 'cast',
    availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'compression',
    handle: 'comp',
    displayName: 'Compression',
    description: 'what earns its space',
    persona: 'reasons about what earns its space',
    eligibility: 'cast',
    availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }],
  },
]

const AUTHOR_CONTEXT_REFERENCE = 'Notes about the author that generalize beyond any single piece.'

const storyEditor: RoleDefinition = {
  id: 'story-editor',
  handle: 'editor',
  eligibility: 'generalist',
  displayName: 'Story Editor',
  description: 'holds the whole of it',
  persona: 'reasons about the whole of it',
  availability: [],
}

describe('pieces', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('creates a piece from a title alone, with the mode default cast enabled and no draft written', async () => {
    const piece = await createPiece(workspaceDir, 'The Cups', flash.id, [flash], specialists)

    expect(piece.id).toBe('the-cups')
    expect(piece.title).toBe('The Cups')
    expect(piece.mode).toBe('flash')
    expect(piece.status).toBe('drafting')
    expect(piece.length).toBe(0)
  })

  it("writes all three surfaces' derived casts in one metadata write", async () => {
    const piece = await createPiece(workspaceDir, 'The Cups', flash.id, [flash], specialists)
    const opened = getPiece(dataRoot, workspaceDir, piece.id, specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE)

    expect(opened.surfaces.draft.cast.map((member) => member.id).sort()).toEqual(['compression', 'shape'])
    // Neither specialist declares availability for the other two surfaces, so both are empty — but present.
    await setPieceCast(workspaceDir, piece.id, specialists, 'storyContext', [])
    await setPieceCast(workspaceDir, piece.id, specialists, 'authorContext', [])
  })

  it('persists whichever loaded mode the author chose, and refuses one that did not load', async () => {
    const piece = await createPiece(workspaceDir, 'A Long Way', epic.id, [flash, epic], specialists)
    expect(piece.mode).toBe('epic')
    expect(getPiece(dataRoot, workspaceDir, piece.id, specialists, storyEditor, [flash, epic], AUTHOR_CONTEXT_REFERENCE).mode).toBe('epic')

    await expect(createPiece(workspaceDir, 'Nope', 'novella', [flash, epic], specialists)).rejects.toThrowError(UnknownModeError)
  })

  it('disambiguates a colliding slug at creation', async () => {
    const first = await createPiece(workspaceDir, 'The Cups', flash.id, [flash], specialists)
    const second = await createPiece(workspaceDir, 'The Cups', flash.id, [flash], specialists)

    expect(first.id).toBe('the-cups')
    expect(second.id).toBe('the-cups-2')
  })

  it('lists a directory scan showing each piece length and modified time', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
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
    await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)

    expect(listPieces(workspaceDir)).toHaveLength(1)
  })

  it('orders the listing by most recently modified first', async () => {
    const older = await createPiece(workspaceDir, 'Older', flash.id, [flash], specialists)
    const newer = await createPiece(workspaceDir, 'Newer', flash.id, [flash], specialists)

    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, older.id, 'piece.yaml'), past, past)

    const listed = listPieces(workspaceDir)
    expect(listed.map((p) => p.id)).toEqual([newer.id, older.id])
  })

  it('opens a piece by its directory id, with an empty draft, no story context and no conversation yet', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    const opened = getPiece(dataRoot, workspaceDir, created.id, specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE)
    const cast = [
      { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'the shape of it', enabled: true },
      { id: 'compression', handle: 'comp', displayName: 'Compression', description: 'what earns its space', enabled: true },
    ]
    expect(opened).toEqual({
      ...created,
      surfaces: {
        draft: { text: '', referenceSchema: null, currentConversationId: null, conversations: [], cast },
        storyContext: { text: '', referenceSchema: flash.storyContextReference, currentConversationId: null, conversations: [], cast: [] },
        authorContext: { text: '', referenceSchema: AUTHOR_CONTEXT_REFERENCE, currentConversationId: null, conversations: [], cast: [] },
      },
      storyEditor: { handle: 'editor', displayName: 'Story Editor', description: 'holds the whole of it' },
    })
  })

  it('opens a piece carrying the draft and the story context the author wrote, verbatim', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    writeFileSync(path.join(workspaceDir, created.id, 'draft.md'), 'Two small words.', 'utf8')
    const storyContextText = '# notes\nPremise: two cups, one left behind\nPoint of view: close third, past tense\n'
    writeFileSync(path.join(workspaceDir, created.id, 'story-context.yaml'), storyContextText, 'utf8')

    const opened = getPiece(dataRoot, workspaceDir, created.id, specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE)
    expect(opened.surfaces.draft.text).toBe('Two small words.')
    expect(opened.surfaces.storyContext.text).toBe(storyContextText)
  })

  it("opens a piece's author-context surface reading the data root's global document, with the studio's reference schema", async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    const opened = getPiece(dataRoot, workspaceDir, created.id, specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE)
    expect(opened.surfaces.authorContext.referenceSchema).toBe(AUTHOR_CONTEXT_REFERENCE)
    expect(opened.surfaces.storyContext.referenceSchema).toBe(flash.storyContextReference)
    expect(opened.surfaces.draft.referenceSchema).toBeNull()
  })

  /**
   * One claim, held by every entry point: a piece is resolved before anything is read or
   * written, so neither a piece that is absent nor an id reaching past the workspace can
   * make one appear.
   */
  it('refuses every way in to a piece that is not there, or whose id would escape the workspace', async () => {
    for (const id of ['nothing-here', '../../etc']) {
      expect(() => getPiece(dataRoot, workspaceDir, id, specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE)).toThrowError(PieceNotFoundError)
      await expect(setPieceCast(workspaceDir, id, specialists, 'draft', ['shape'])).rejects.toThrowError(PieceNotFoundError)
      await expect(updatePieceDetails(workspaceDir, id, { title: 'Anything' })).rejects.toThrowError(PieceNotFoundError)
      await expect(new DraftWriter(new DraftStore()).save(workspaceDir, id, 'text')).rejects.toThrowError(PieceNotFoundError)
    }
  })
})

describe('setPieceCast', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('disables a specialist, reports the cast as it now stands, and makes it eligible again when named once more', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)

    const disabled = await setPieceCast(workspaceDir, created.id, specialists, 'draft', ['shape'])

    expect(disabled).toEqual([
      { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'the shape of it', enabled: true },
      { id: 'compression', handle: 'comp', displayName: 'Compression', description: 'what earns its space', enabled: false },
    ])
    expect(getPiece(dataRoot, workspaceDir, created.id, specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE).surfaces.draft.cast).toEqual(disabled)

    const reEnabled = await setPieceCast(workspaceDir, created.id, specialists, 'draft', ['shape', 'compression'])
    expect(reEnabled.find((member) => member.id === 'compression')?.enabled).toBe(true)
  })

  it("never widens the room past the mode's cast: an id outside it is a stated UnknownCastMemberError", async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)

    await expect(setPieceCast(workspaceDir, created.id, specialists, 'draft', ['shape', 'story-editor'])).rejects.toThrowError(
      UnknownCastMemberError,
    )
  })

  it("stores each surface's cast independently of the others", async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)

    await setPieceCast(workspaceDir, created.id, specialists, 'draft', ['shape'])
    await setPieceCast(workspaceDir, created.id, specialists, 'storyContext', [])

    const opened = getPiece(dataRoot, workspaceDir, created.id, specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE)
    expect(opened.surfaces.draft.cast.find((member) => member.id === 'shape')?.enabled).toBe(true)
  })
})

describe('updatePieceDetails', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('retitles a piece, leaving its mode, status and directory untouched', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)

    const summary = await updatePieceDetails(workspaceDir, created.id, { title: 'The Cups' })

    expect(summary).toMatchObject({ id: 'cups', title: 'The Cups', mode: 'flash', status: 'drafting' })
    expect(getPiece(dataRoot, workspaceDir, 'cups', specialists, storyEditor, [flash], AUTHOR_CONTEXT_REFERENCE).title).toBe('The Cups')
  })

  it('marks a piece finished or abandoned, with no transition it refuses', async () => {
    const created = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)

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
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)

    await draftWriter().save(workspaceDir, piece.id, 'Two small words.')

    expect(readFileSync(path.join(workspaceDir, piece.id, 'draft.md'), 'utf8')).toBe('Two small words.')
  })
})

describe('getConversation', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  function scopeFor(pieceId: string): ConversationScope {
    return { kind: 'piece', workspaceDir, pieceId, surface: 'draft' }
  }

  it('reports a conversation nothing has written yet as a stated ConversationNotFoundError', async () => {
    await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    expect(() => getConversation(dataRoot, workspaceDir, 'cups', 'c1')).toThrowError(ConversationNotFoundError)
  })

  it('joins an application onto the change it produced, by identity, and leaves an unapplied response with none', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
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
    const scope = scopeFor(piece.id)
    for (const entry of [authorMessage, response, otherResponse, application]) await store.append(dataRoot, scope, 'c1', entry)

    const change: AppliedChange = { id: 'change1', content: { kind: 'passages', passages: [{ before: 'the second paragraph', after: '' }] } }
    await writeAppliedChange(dataRoot, scope, change)

    const conversation = getConversation(dataRoot, workspaceDir, piece.id, 'c1')

    const applicationView = conversation.entries.find((entry) => entry.kind === 'application')
    expect(applicationView).toMatchObject({ responseId: 'e2', changeId: 'change1', change: change.content })
  })

  it('degrades to the application shown without its change when the change file is missing, rather than erroring', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    const store = new ConversationEntryStore()
    const application: ConversationEntry = { id: 'e1', kind: 'application', responseId: 'no-such-response', changeId: 'never-written' }
    await store.append(dataRoot, scopeFor(piece.id), 'c1', application)

    const conversation = getConversation(dataRoot, workspaceDir, piece.id, 'c1')
    expect(conversation.entries[0]).toMatchObject({ kind: 'application', change: undefined })
  })
})

describe('listConversations', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports none for a piece with no conversations', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    expect(listConversations(dataRoot, workspaceDir, piece.id)).toEqual([])
  })

  // Which entry the opening words come from belongs to `shared/conversationEntries.test.ts`.
  it("carries the conversation's opening words onto the summary", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    await new ConversationEntryStore().append(dataRoot, { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'draft' }, 'c1', {
      id: 'e1',
      kind: 'authorMessage',
      text: 'does the opening earn its length',
      audience: [],
      brought: [],
    })

    const [summary] = listConversations(dataRoot, workspaceDir, piece.id)
    expect(summary).toMatchObject({ id: 'c1', opening: 'does the opening earn its length' })
  })

  it('orders the listing by last activity, most recent first', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    const store = new ConversationEntryStore()
    const scope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'draft' }
    const anyEntry: ConversationEntry = { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] }
    await store.append(dataRoot, scope, 'older', anyEntry)
    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, piece.id, 'conversations', 'draft', 'older.json'), past, past)
    await store.append(dataRoot, scope, 'newer', anyEntry)

    expect(listConversations(dataRoot, workspaceDir, piece.id).map((c) => c.id)).toEqual(['newer', 'older'])
  })
})

describe('deleteConversation', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-data-root-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('reports a conversation nothing has written yet as a stated ConversationNotFoundError', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    await expect(deleteConversation(dataRoot, workspaceDir, piece.id, 'never-written')).rejects.toThrowError(ConversationNotFoundError)
  })

  it('removes the conversation and the change files its applications name, leaving the rest untouched', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', flash.id, [flash], specialists)
    const store = new ConversationEntryStore()
    const scope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'draft' }
    await store.append(dataRoot, scope, 'c1', { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] })
    await store.append(dataRoot, scope, 'c1', { id: 'e2', kind: 'application', responseId: 'e1', changeId: 'change1' })
    await store.append(dataRoot, scope, 'c2', { id: 'e1', kind: 'authorMessage', text: 'y', audience: [], brought: [] })

    const ownChange: AppliedChange = { id: 'change1', content: { kind: 'passages', passages: [{ before: 'it', after: '' }] } }
    const unrelatedChange: AppliedChange = { id: 'change2', content: { kind: 'rewrittenWhole' } }
    await writeAppliedChange(dataRoot, scope, ownChange)
    await writeAppliedChange(dataRoot, scope, unrelatedChange)

    await deleteConversation(dataRoot, workspaceDir, piece.id, 'c1')

    expect(() => getConversation(dataRoot, workspaceDir, piece.id, 'c1')).toThrowError(ConversationNotFoundError)
    expect(listConversations(dataRoot, workspaceDir, piece.id).map((c) => c.id)).toEqual(['c2'])
    expect(readAppliedChanges(dataRoot, scope, appliedChangeSchema)).toEqual([unrelatedChange])
  })
})
