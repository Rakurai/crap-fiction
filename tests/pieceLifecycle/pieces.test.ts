import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ConversationNotFoundError,
  createPiece,
  deleteConversation,
  getConversation,
  getPiece,
  listConversations,
  listPieces,
  PieceDocumentWriter,
  PieceNotFoundError,
  setPieceCast,
  UnknownCastMemberError,
  updatePieceDetails,
} from '../../src/server/pieces.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { ShippedContentCatalog, UnknownModeError } from '../../src/server/shippedContent.js'
import {
  AuthorContextStore,
  ConversationEntryStore,
  DraftStore,
  PieceMetadataStore,
  readAppliedChanges,
  StoryContextStore,
  writeAppliedChange,
  writeAuthorContext,
} from '../../src/server/store/index.js'
import type { ConversationScope } from '../../src/server/scope.js'
import { appliedChangeSchema, type AppliedChange } from '../../src/shared/appliedChange.js'
import type { ConversationEntry } from '../../src/shared/conversationEntries.js'
import type { AddressableParticipantView } from '../../src/shared/pieceViews.js'
import { AUTHOR_CONTEXT_REFERENCE_FIXTURE, INTERVIEWER_ROSTER_FIXTURE, MODE_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../support/roomFixtures.js'

const EPIC: ModeDescriptor = {
  id: 'epic',
  displayName: 'Epic',
  description: 'A piece read over several sittings.',
  storyContextReference: 'Sections, each holding entries.',
}

const SPECIALISTS: readonly RoleDefinition[] = [
  {
    id: 'shape',
    handle: 'shape',
    displayName: 'Shape',
    description: 'the shape of it',
    mark: 'SH',
    persona: 'reasons about the shape of it',
    eligibility: 'cast',
    function: undefined,
    availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'compression',
    handle: 'comp',
    displayName: 'Compression',
    description: 'what earns its space',
    mark: 'CO',
    persona: 'reasons about what earns its space',
    eligibility: 'cast',
    function: undefined,
    availability: [{ mode: 'flash', surface: 'draft', enabledByDefault: true }],
  },
]

const INTERVIEWER = INTERVIEWER_ROSTER_FIXTURE

const STORY_EDITOR: RoleDefinition = {
  id: 'story-editor',
  handle: 'editor',
  eligibility: 'generalist',
  function: undefined,
  displayName: 'Story Editor',
  description: 'holds the whole of it',
  mark: 'SE',
  persona: 'reasons about the whole of it',
  availability: [],
}

function catalogFor(modes: readonly ModeDescriptor[], roles: readonly RoleDefinition[] = SPECIALISTS): ShippedContentCatalog {
  return ShippedContentCatalog.assemble({
    modes,
    roles: [...roles, STORY_EDITOR, INTERVIEWER.role],
    charter: 'unused in these tests',
    fragments: PROMPT_FRAGMENTS_FIXTURE,
    authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
  })
}

const pieceMetadata = new PieceMetadataStore()

type CastParticipantView = Extract<AddressableParticipantView, { eligibility: 'cast' }>

function specialistsIn(addressable: readonly AddressableParticipantView[]): readonly CastParticipantView[] {
  return addressable.filter((participant): participant is CastParticipantView => participant.eligibility === 'cast')
}

describe('creating a piece, listing the workspace, and opening one again', () => {
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
    const piece = await createPiece(pieceMetadata, workspaceDir, 'The Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    expect(piece.id).toBe('the-cups')
    expect(piece.title).toBe('The Cups')
    expect(piece.mode).toBe('flash')
    expect(piece.length).toBe(0)
  })

  it("writes all three surfaces' derived casts in one metadata write", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'The Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const opened = getPiece(dataRoot, workspaceDir, piece.id, catalogFor([MODE_FIXTURE]))

    expect(specialistsIn(opened.surfaces.draft.addressable).map((member) => member.id).sort()).toEqual(['compression', 'shape'])
    expect(specialistsIn(opened.surfaces.storyContext.addressable)).toEqual([])
    expect(specialistsIn(opened.surfaces.authorContext.addressable)).toEqual([])
  })

  it('persists whichever loaded mode the author chose, and refuses one that did not load', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'A Long Way', EPIC.id, catalogFor([MODE_FIXTURE, EPIC]))
    expect(piece.mode).toBe('epic')
    expect(getPiece(dataRoot, workspaceDir, piece.id, catalogFor([MODE_FIXTURE, EPIC])).mode).toBe('epic')

    await expect(createPiece(pieceMetadata, workspaceDir, 'Nope', 'novella', catalogFor([MODE_FIXTURE, EPIC]))).rejects.toThrowError(UnknownModeError)
  })

  it('disambiguates a colliding slug at creation', async () => {
    const first = await createPiece(pieceMetadata, workspaceDir, 'The Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const second = await createPiece(pieceMetadata, workspaceDir, 'The Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    expect(first.id).toBe('the-cups')
    expect(second.id).toBe('the-cups-2')
  })

  it('lists a directory scan showing each piece length and modified time', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
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
    await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    expect(listPieces(workspaceDir)).toHaveLength(1)
  })

  it('orders the listing by most recently modified first', async () => {
    const older = await createPiece(pieceMetadata, workspaceDir, 'Older', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const newer = await createPiece(pieceMetadata, workspaceDir, 'Newer', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, older.id, 'piece.yaml'), past, past)

    const listed = listPieces(workspaceDir)
    expect(listed.map((p) => p.id)).toEqual([newer.id, older.id])
  })

  it('opens a piece by its directory id, with an empty draft, no story context and no conversation yet', async () => {
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const opened = getPiece(dataRoot, workspaceDir, created.id, catalogFor([MODE_FIXTURE]))
    const storyEditorAddressable = {
      id: 'story-editor',
      handle: 'editor',
      displayName: 'Story Editor',
      description: 'holds the whole of it',
      mark: 'SE',
      eligibility: 'generalist',
    }
    const interviewerAddressable = {
      id: INTERVIEWER.role.id,
      handle: INTERVIEWER.role.handle,
      displayName: INTERVIEWER.role.displayName,
      description: INTERVIEWER.role.description,
      mark: INTERVIEWER.role.mark,
      ordinal: 2,
      eligibility: 'addressed-only',
    }
    const contextAddressable = [storyEditorAddressable, interviewerAddressable]
    expect(opened).toEqual({
      ...created,
      surfaces: {
        draft: {
          text: '',
          location: 'draft.md',
          referenceSchema: null,
          currentConversationId: null,
          conversations: [],
          addressable: [
            { id: 'shape', handle: 'shape', displayName: 'Shape', description: 'the shape of it', mark: 'SH', ordinal: 0, eligibility: 'cast', enabled: true },
            {
              id: 'compression',
              handle: 'comp',
              displayName: 'Compression',
              description: 'what earns its space',
              mark: 'CO',
              ordinal: 1,
              eligibility: 'cast',
              enabled: true,
            },
            ...contextAddressable,
          ],
        },
        storyContext: {
          text: '',
          location: 'story-context.yaml',
          referenceSchema: MODE_FIXTURE.storyContextReference,
          currentConversationId: null,
          conversations: [],
          addressable: contextAddressable,
        },
        authorContext: {
          text: '',
          location: 'config/author-context.yaml',
          referenceSchema: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
          currentConversationId: null,
          conversations: [],
          addressable: contextAddressable,
        },
      },
      storyEditor: { handle: 'editor', displayName: 'Story Editor', description: 'holds the whole of it', mark: 'SE' },
      interviewer: {
        handle: INTERVIEWER.role.handle,
        displayName: INTERVIEWER.role.displayName,
        description: INTERVIEWER.role.description,
        invocation: INTERVIEWER.invocation,
      },
    })
  })

  it('opens a piece carrying the draft and the story context the author wrote, verbatim', async () => {
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    writeFileSync(path.join(workspaceDir, created.id, 'draft.md'), 'Two small words.', 'utf8')
    const storyContextText = '# notes\nPremise: two cups, one left behind\nPoint of view: close third, past tense\n'
    writeFileSync(path.join(workspaceDir, created.id, 'story-context.yaml'), storyContextText, 'utf8')

    const opened = getPiece(dataRoot, workspaceDir, created.id, catalogFor([MODE_FIXTURE]))
    expect(opened.surfaces.draft.text).toBe('Two small words.')
    expect(opened.surfaces.storyContext.text).toBe(storyContextText)
  })

  it("opens a piece's author-context surface reading the data root's global document, with the studio's reference schema", async () => {
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const opened = getPiece(dataRoot, workspaceDir, created.id, catalogFor([MODE_FIXTURE]))
    expect(opened.surfaces.authorContext.referenceSchema).toBe(AUTHOR_CONTEXT_REFERENCE_FIXTURE)
    expect(opened.surfaces.storyContext.referenceSchema).toBe(MODE_FIXTURE.storyContextReference)
    expect(opened.surfaces.draft.referenceSchema).toBeNull()
  })

  it('refuses to open a piece whose mode is not loaded, rather than reporting a story context with no reference schema', async () => {
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    expect(() => getPiece(dataRoot, workspaceDir, created.id, catalogFor([]))).toThrowError(UnknownModeError)
  })

  it('finds the same author-context document and conversations from two pieces in different workspaces, while their casts stay distinct', async () => {
    const archivist: RoleDefinition = {
      id: 'archivist',
      handle: 'archivist',
      displayName: 'Archivist',
      description: 'keeps the notes that outlast any one piece',
      mark: 'AR',
      persona: 'reasons about the notes that outlast any one piece',
      eligibility: 'cast',
      function: undefined,
      availability: [{ mode: 'flash', surface: 'authorContext', enabledByDefault: false }],
    }
    const withArchivist = [...SPECIALISTS, archivist]

    const otherWorkspaceDir = path.join(dataRoot, 'another-writing')
    mkdirSync(otherWorkspaceDir, { recursive: true })

    const inFirst = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE], withArchivist))
    const inSecond = await createPiece(pieceMetadata, otherWorkspaceDir, 'Saucers', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE], withArchivist))

    await writeAuthorContext(dataRoot, 'Notes that generalize across every piece.')
    await new ConversationEntryStore().append(dataRoot, { kind: 'global' }, 'shared-conversation', {
      id: 'e1',
      kind: 'authorMessage',
      text: 'a note that belongs to no single piece',
      audience: [],
      brought: [],
    })
    await setPieceCast(pieceMetadata, workspaceDir, inFirst.id, catalogFor([MODE_FIXTURE], withArchivist), 'authorContext', ['archivist'])

    const openedFromFirst = getPiece(dataRoot, workspaceDir, inFirst.id, catalogFor([MODE_FIXTURE], withArchivist))
    const openedFromSecond = getPiece(dataRoot, otherWorkspaceDir, inSecond.id, catalogFor([MODE_FIXTURE], withArchivist))

    expect(openedFromFirst.surfaces.authorContext.text).toBe('Notes that generalize across every piece.')
    expect(openedFromSecond.surfaces.authorContext.text).toBe(openedFromFirst.surfaces.authorContext.text)
    expect(openedFromFirst.surfaces.authorContext.conversations.map((c) => c.id)).toEqual(['shared-conversation'])
    expect(openedFromSecond.surfaces.authorContext.conversations).toEqual(openedFromFirst.surfaces.authorContext.conversations)

    expect(specialistsIn(openedFromFirst.surfaces.authorContext.addressable).find((member) => member.id === 'archivist')?.enabled).toBe(true)
    expect(specialistsIn(openedFromSecond.surfaces.authorContext.addressable).find((member) => member.id === 'archivist')?.enabled).toBe(false)
  })

  it('refuses every way in to a piece that is not there, or whose id would escape the workspace', async () => {
    for (const id of ['nothing-here', '../../etc']) {
      expect(() => getPiece(dataRoot, workspaceDir, id, catalogFor([MODE_FIXTURE]))).toThrowError(PieceNotFoundError)
      await expect(setPieceCast(pieceMetadata, workspaceDir, id, catalogFor([MODE_FIXTURE]), 'draft', ['shape'])).rejects.toThrowError(PieceNotFoundError)
      await expect(updatePieceDetails(pieceMetadata, workspaceDir, id, { title: 'Anything' })).rejects.toThrowError(PieceNotFoundError)
      await expect(
        new PieceDocumentWriter(new DraftStore(), new StoryContextStore(), new AuthorContextStore(), dataRoot).save(workspaceDir, id, 'draft', 'text'),
      ).rejects.toThrowError(PieceNotFoundError)
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
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    const disabled = await setPieceCast(pieceMetadata, workspaceDir, created.id, catalogFor([MODE_FIXTURE]), 'draft', ['shape'])

    expect(specialistsIn(disabled).map((member) => ({ id: member.id, enabled: member.enabled }))).toEqual([
      { id: 'shape', enabled: true },
      { id: 'compression', enabled: false },
    ])
    expect(getPiece(dataRoot, workspaceDir, created.id, catalogFor([MODE_FIXTURE])).surfaces.draft.addressable).toEqual(disabled)

    const reEnabled = await setPieceCast(pieceMetadata, workspaceDir, created.id, catalogFor([MODE_FIXTURE]), 'draft', ['shape', 'compression'])
    expect(specialistsIn(reEnabled).find((member) => member.id === 'compression')?.enabled).toBe(true)
  })

  it("never widens the room past the mode's cast: an id outside it is a stated UnknownCastMemberError", async () => {
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    await expect(setPieceCast(pieceMetadata, workspaceDir, created.id, catalogFor([MODE_FIXTURE]), 'draft', ['shape', 'story-editor'])).rejects.toThrowError(
      UnknownCastMemberError,
    )
  })

  it("stores each surface's cast independently of the others", async () => {
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    await setPieceCast(pieceMetadata, workspaceDir, created.id, catalogFor([MODE_FIXTURE]), 'draft', ['shape'])
    await setPieceCast(pieceMetadata, workspaceDir, created.id, catalogFor([MODE_FIXTURE]), 'storyContext', [])

    const opened = getPiece(dataRoot, workspaceDir, created.id, catalogFor([MODE_FIXTURE]))
    expect(specialistsIn(opened.surfaces.draft.addressable).map((member) => ({ id: member.id, enabled: member.enabled }))).toEqual([
      { id: 'shape', enabled: true },
      { id: 'compression', enabled: false },
    ])
    expect(specialistsIn(opened.surfaces.storyContext.addressable)).toEqual([])
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

  it('retitles a piece, leaving its mode and directory untouched', async () => {
    const created = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))

    const summary = await updatePieceDetails(pieceMetadata, workspaceDir, created.id, { title: 'The Cups' })

    expect(summary).toMatchObject({ id: 'cups', title: 'The Cups', mode: 'flash' })
    expect(getPiece(dataRoot, workspaceDir, 'cups', catalogFor([MODE_FIXTURE])).title).toBe('The Cups')
  })
})

describe('PieceDocumentWriter', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-workspace-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  function documentWriter(): PieceDocumentWriter {
    return new PieceDocumentWriter(new DraftStore(), new StoryContextStore(), new AuthorContextStore(), workspaceDir)
  }

  it('routes each surface to the artifact it is kept in: the draft and story context under the piece, the author context beside the workspace', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const writer = documentWriter()

    await writer.save(workspaceDir, piece.id, 'draft', 'Two small words.')
    await writer.save(workspaceDir, piece.id, 'storyContext', 'Premise: two cups, one left behind\n')
    await writer.save(workspaceDir, piece.id, 'authorContext', 'Prefers the plainer word.\n')

    function written(...segments: readonly string[]): string {
      return readFileSync(path.join(workspaceDir, ...segments), 'utf8')
    }

    expect(written(piece.id, 'draft.md')).toBe('Two small words.')
    expect(written(piece.id, 'story-context.yaml')).toBe('Premise: two cups, one left behind\n')
    expect(written('config', 'author-context.yaml')).toBe('Prefers the plainer word.\n')
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

  it('refuses to read a conversation nothing has written yet, as a stated ConversationNotFoundError', async () => {
    await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    expect(() => getConversation(dataRoot, workspaceDir, 'cups', 'draft', 'c1')).toThrowError(ConversationNotFoundError)
  })

  it('joins an application onto the change it produced, by identity, and leaves an unapplied response with none', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
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

    const change: AppliedChange = {
      id: 'change1',
      content: { kind: 'passages', passages: [{ leading: '', before: 'the second paragraph', after: '', trailing: '' }] },
    }
    await writeAppliedChange(dataRoot, scope, change)

    const conversation = getConversation(dataRoot, workspaceDir, piece.id, 'draft', 'c1')

    const applicationView = conversation.entries.find((entry) => entry.kind === 'application')
    expect(applicationView).toMatchObject({ responseId: 'e2', changeId: 'change1', change: change.content })
  })

  it('degrades to the application shown without its change when the change file is missing, rather than erroring', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const store = new ConversationEntryStore()
    const application: ConversationEntry = { id: 'e1', kind: 'application', responseId: 'no-such-response', changeId: 'never-written' }
    await store.append(dataRoot, scopeFor(piece.id), 'c1', application)

    const conversation = getConversation(dataRoot, workspaceDir, piece.id, 'draft', 'c1')
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
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    expect(listConversations(dataRoot, workspaceDir, piece.id, 'draft')).toEqual([])
  })

  it("carries the conversation's opening words onto the summary", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    await new ConversationEntryStore().append(dataRoot, { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'draft' }, 'c1', {
      id: 'e1',
      kind: 'authorMessage',
      text: 'does the opening earn its length',
      audience: [],
      brought: [],
    })

    const [summary] = listConversations(dataRoot, workspaceDir, piece.id, 'draft')
    expect(summary).toMatchObject({ id: 'c1', opening: 'does the opening earn its length' })
  })

  it('orders the listing by last activity, most recent first', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const store = new ConversationEntryStore()
    const scope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'draft' }
    const anyEntry: ConversationEntry = { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] }
    await store.append(dataRoot, scope, 'older', anyEntry)
    const past = new Date(Date.now() - 10_000)
    utimesSync(path.join(workspaceDir, piece.id, 'conversations', 'draft', 'older.json'), past, past)
    await store.append(dataRoot, scope, 'newer', anyEntry)

    expect(listConversations(dataRoot, workspaceDir, piece.id, 'draft').map((c) => c.id)).toEqual(['newer', 'older'])
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

  it('refuses to delete a conversation nothing has written yet, as a stated ConversationNotFoundError', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    await expect(deleteConversation(dataRoot, workspaceDir, piece.id, 'draft', 'never-written')).rejects.toThrowError(ConversationNotFoundError)
  })

  it('removes the conversation and the change files its applications name, leaving the rest untouched', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, catalogFor([MODE_FIXTURE]))
    const store = new ConversationEntryStore()
    const scope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'draft' }
    await store.append(dataRoot, scope, 'c1', { id: 'e1', kind: 'authorMessage', text: 'x', audience: [], brought: [] })
    await store.append(dataRoot, scope, 'c1', { id: 'e2', kind: 'application', responseId: 'e1', changeId: 'change1' })
    await store.append(dataRoot, scope, 'c2', { id: 'e1', kind: 'authorMessage', text: 'y', audience: [], brought: [] })

    const ownChange: AppliedChange = {
      id: 'change1',
      content: { kind: 'passages', passages: [{ leading: '', before: 'it', after: '', trailing: '' }] },
    }
    const unrelatedChange: AppliedChange = { id: 'change2', content: { kind: 'rewrittenWhole' } }
    await writeAppliedChange(dataRoot, scope, ownChange)
    await writeAppliedChange(dataRoot, scope, unrelatedChange)

    await deleteConversation(dataRoot, workspaceDir, piece.id, 'draft', 'c1')

    expect(() => getConversation(dataRoot, workspaceDir, piece.id, 'draft', 'c1')).toThrowError(ConversationNotFoundError)
    expect(listConversations(dataRoot, workspaceDir, piece.id, 'draft').map((c) => c.id)).toEqual(['c2'])
    expect(readAppliedChanges(dataRoot, scope, appliedChangeSchema)).toEqual([unrelatedChange])
  })
})
