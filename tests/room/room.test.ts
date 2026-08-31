import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import pino from 'pino'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canonicalMarkdown } from '../../src/document/markdown.js'
import type { ModelAccess } from '../../src/server/model/types.js'
import type { RoleDefinition } from '../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../src/server/modes.js'
import { ConversationNotFoundError, createPiece } from '../../src/server/pieces.js'
import type { ConversationScope, RoomScope } from '../../src/server/scope.js'
import {
  ConversationEntryStore,
  DraftStore,
  PieceMetadataStore,
  readAppliedChanges,
  readConversationEntries,
  readPiece,
  TolerantReadError,
  writeAuthorContext,
  writeStoryContext,
} from '../../src/server/store/index.js'
import { appliedChangeSchema } from '../../src/shared/appliedChange.js'
import type { ConversationEntry } from '../../src/shared/conversationEntries.js'
import type { ParticipantActivityEvent, RoomEvent } from '../../src/shared/conversationEvents.js'
import type { DocumentSnapshot } from '../../src/shared/surfaces.js'
import {
  ApplicationDocumentNotSavedError,
  ApplicationNotPendingError,
  CommentaryNotFoundError,
  type DispatchOpening,
  ParticipantNotFoundError,
  RecommendationNotFoundError,
  Room,
  RoomBusyError,
} from '../../src/server/room/room.js'
import { SHIPPED_HISTORY_POLICY } from '../../src/server/room/context.js'
import { ShippedContentCatalog } from '../../src/server/shippedContent.js'
import { createLogger } from '../../src/server/logger.js'
import { FixtureModelAdapter, type FixtureBehavior, type FixtureScript } from '../support/modelAdapter.js'
import { buildTestRoom } from '../support/room.js'
import { AUTHOR_CONTEXT_REFERENCE_FIXTURE, CHARTER_FIXTURE, INTERVIEWER_FIXTURE, MODE_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../support/roomFixtures.js'
import { failureCodeSchema } from '../../src/shared/envelope.js'

const pieceMetadata = new PieceMetadataStore()

const FIXTURE_ROLES: readonly RoleDefinition[] = [
  {
    id: 'shape',
    handle: 'shape',
    displayName: 'Shape',
    description: 'x',
    mark: 'SH',
    persona: 'reasons about x',
    eligibility: 'cast',
    function: undefined,
    availability: [{ mode: MODE_FIXTURE.id, surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'compression',
    handle: 'compression',
    displayName: 'Compression',
    description: 'y',
    mark: 'CO',
    persona: 'reasons about y',
    eligibility: 'cast',
    function: undefined,
    availability: [{ mode: MODE_FIXTURE.id, surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'interiority',
    handle: 'interiority',
    displayName: 'Interiority',
    description: 'v',
    mark: 'IN',
    persona: 'reasons about v',
    eligibility: 'cast',
    function: undefined,
    availability: [{ mode: 'novella', surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'story-editor',
    handle: 'editor',
    displayName: 'Story Editor',
    description: 'z',
    mark: 'SE',
    persona: 'reasons about z',
    eligibility: 'generalist',
    function: undefined,
    availability: [],
  },
  {
    id: 'toolsmith',
    handle: 'toolsmith',
    displayName: 'Toolsmith',
    description: 'w',
    mark: 'TO',
    persona: 'reasons about w',
    eligibility: 'addressed-only',
    function: undefined,
    availability: [],
  },
  INTERVIEWER_FIXTURE,
]

const FIXTURE_SPECIALISTS: readonly RoleDefinition[] = FIXTURE_ROLES.filter((role) => role.eligibility === 'cast')

const FIXTURE_CATALOG: ShippedContentCatalog = ShippedContentCatalog.assemble({
  modes: [MODE_FIXTURE],
  roles: FIXTURE_ROLES,
  charter: CHARTER_FIXTURE,
  fragments: PROMPT_FRAGMENTS_FIXTURE,
  authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
})

class EntryStoreRefusing extends ConversationEntryStore {
  readonly #refused: string

  constructor(refusedParticipantId: string) {
    super()
    this.#refused = refusedParticipantId
  }

  override async append(dataRoot: string, scope: ConversationScope, conversationId: string, entry: ConversationEntry): Promise<void> {
    if ('participantId' in entry && entry.participantId === this.#refused) throw new Error('the conversation file refused the write')
    await super.append(dataRoot, scope, conversationId, entry)
  }
}

function roomSpecWith(modelAccess: ModelAccess, entries: ConversationEntryStore) {
  return {
    modes: [MODE_FIXTURE],
    roles: FIXTURE_ROLES,
    charter: CHARTER_FIXTURE,
    fragments: PROMPT_FRAGMENTS_FIXTURE,
    policy: SHIPPED_HISTORY_POLICY,
    applying: { rounds: 3 },
    modelAccess,
    entries,
    logger: createLogger('silent'),
    now: () => 1_700_000_000_000,
    authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
  }
}

function closingWatch(): { logger: pino.Logger; closed: (actionId: string) => Promise<void> } {
  const seen = new Set<string>()
  const waiting = new Map<string, () => void>()
  const logger = pino(
    { level: 'info' },
    {
      write: (line: string) => {
        const logged: { msg?: string; actionId?: string } = JSON.parse(line)
        if (logged.msg !== 'conversation action closed' || logged.actionId === undefined) return
        seen.add(logged.actionId)
        waiting.get(logged.actionId)?.()
      },
    },
  )
  return {
    logger,
    closed: (actionId) =>
      seen.has(actionId) ? Promise.resolve() : new Promise<void>((resolve) => waiting.set(actionId, resolve)),
  }
}

function buildRoom(
  dataRoot: string,
  behaviors: Readonly<Record<string, FixtureScript>>,
): { room: Room; adapter: FixtureModelAdapter; closed: (actionId: string) => Promise<void> } {
  const adapter = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
  const { logger, closed } = closingWatch()
  const room = buildTestRoom(dataRoot, { ...roomSpecWith(adapter, new ConversationEntryStore()), logger })
  return { room, adapter, closed }
}

function scope(pieceId: string): RoomScope {
  return { pieceId, surface: 'draft' }
}

function documents(draft: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot {
  return { draft, storyContext: '', authorContext: '', ...overrides }
}

function draftScope(workspaceDir: string, pieceId: string): ConversationScope {
  return { kind: 'piece', workspaceDir, pieceId, surface: 'draft' }
}

const conversationIds = new Map<string, string>()

beforeEach(() => {
  conversationIds.clear()
})

function cid(roomScope: RoomScope, label: string): string {
  return conversationIds.get(`${roomScope.pieceId}|${roomScope.surface}|${label}`) ?? label
}

async function dispatch(
  room: Room,
  workspaceDir: string,
  roomScope: RoomScope,
  label: string,
  opening: DispatchOpening,
  snapshot: DocumentSnapshot,
): Promise<{ conversationId: string; actionId: string }> {
  const key = `${roomScope.pieceId}|${roomScope.surface}|${label}`
  const conversationId = conversationIds.get(key) ?? room.mintConversation(workspaceDir, roomScope).id
  conversationIds.set(key, conversationId)
  return room.dispatch(workspaceDir, roomScope, conversationId, opening, snapshot)
}

function entries(dataRoot: string, workspaceDir: string, pieceId: string, label: string): readonly ConversationEntry[] {
  return readConversationEntries(dataRoot, draftScope(workspaceDir, pieceId), cid(scope(pieceId), label))?.entries ?? []
}

function untilIdle(room: Room, pieceId: string): Promise<void> {
  return untilIdleInScope(room, scope(pieceId))
}

function untilIdleInScope(room: Room, roomScope: RoomScope): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = room.subscribe(roomScope.pieceId, (event) => {
      if (event.type !== 'action.finished' || event.data.surface !== roomScope.surface) return
      unsubscribe()
      resolve()
    })
    if (room.activitySnapshot(roomScope) !== undefined) return
    unsubscribe()
    resolve()
  })
}

function nextEntryAppended(room: Room, pieceId: string, participantId: string): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = room.subscribe(pieceId, (event) => {
      if (event.type !== 'entry.appended') return
      const entry = event.data.entry
      if ('participantId' in entry && entry.participantId === participantId) {
        unsubscribe()
        resolve()
      }
    })
  })
}

describe('Room.dispatch', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-room-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it("an unaddressed dispatch reads nothing for addressing and calls the enabled cast, never a specialist the piece's mode does not offer", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    await pieceMetadata.writeCast(workspaceDir, piece.id, 'draft', ['shape', 'compression', 'interiority'])
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', text: 'a message', audience: [] })
    expect(landed.filter((entry) => entry.kind === 'participantResponse')).toHaveLength(2)
    expect(adapter.promptFor('shape')).toContain('a message')
    expect(adapter.promptFor('interiority')).toBeUndefined()
  })

  it('states a failure synchronously, rather than opening an action, when the conversation on disk cannot be read', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {})
    const conversationId = room.mintConversation(workspaceDir, scope(piece.id)).id
    mkdirSync(path.join(workspaceDir, piece.id, 'conversations', 'draft'), { recursive: true })
    writeFileSync(path.join(workspaceDir, piece.id, 'conversations', 'draft', `${conversationId}.json`), '{ not valid json', 'utf8')

    await expect(
      room.dispatch(workspaceDir, scope(piece.id), conversationId, { kind: 'message', text: 'a message' }, documents('draft text')),
    ).rejects.toThrowError(TolerantReadError)
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
  })

  it('reaches a compiled prompt exactly as submitted, comments and malformed YAML alike, since story context is opaque text — and never as reread from disk', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    await writeStoryContext(workspaceDir, piece.id, 'stale text nobody submitted')
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    await dispatch(room,
      workspaceDir,
      scope(piece.id),
      'c1',
      { kind: 'message', text: 'a message' },
      documents('draft text', { storyContext: '# notes\nPremise: not valid: [yaml\n' }),
    )
    await untilIdle(room, piece.id)

    expect(adapter.promptFor('shape')).toContain('# notes\nPremise: not valid: [yaml')
    expect(adapter.promptFor('shape')).not.toContain('stale text nobody submitted')
  })

  it("owns the dispatch's own collapse: a seam that throws instead of failing closes the action and is stated, not rethrown into nothing", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const broken: ModelAccess = {
      call: () => Promise.reject(new Error('the seam broke in a way nothing named')),
      status: () => Promise.resolve({ reachable: true, models: [] }),
    }
    const room = buildTestRoom(dataRoot, roomSpecWith(broken, new ConversationEntryStore()))

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))

    await expect(untilIdle(room, piece.id)).resolves.toBeUndefined()

    expect(events.map((event) => event.type)).toEqual([
      'action.started',
      'entry.appended',
      'participant.activity',
      'participant.activity',
      'error',
      'action.finished',
    ])
    expect(events.find((event) => event.type === 'error')?.data).toMatchObject({
      code: failureCodeSchema.enum.UNEXPECTED_FAILURE,
      message: 'the seam broke in a way nothing named',
    })
    expect(events.find((event) => event.type === 'action.finished')?.data).toMatchObject({ outcome: 'failed' })

    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
  })

  it('writes the author entry before any participant is called, then appends each response as it lands, reporting each as working first', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } }, held: true, states: ['working'] },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true, states: ['working'] },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true, states: ['working'] },
    })

    const events: string[] = []
    room.subscribe(piece.id, (event) => {
      if (event.type === 'action.started' && event.data.kind === 'dispatch') events.push(`started:${event.data.audience.join(',')}`)
      if (event.type === 'participant.activity') events.push(`state:${event.data.participantId}:${event.data.state}`)
      if (event.type === 'entry.appended' && event.data.entry.kind === 'participantResponse') events.push(`settled:${event.data.entry.participantId}`)
      if (event.type === 'entry.appended' && event.data.entry.kind === 'participantNoComment') events.push(`settled:${event.data.entry.participantId}`)
      if (event.type === 'action.finished') events.push(`finished:${event.data.outcome}`)
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const settled = untilIdle(room, piece.id)
    expect(events[0]).toBe('started:shape,compression,story-editor')
    expect(entries(dataRoot, workspaceDir, piece.id, conversationId)).toMatchObject([{ kind: 'authorMessage', text: 'a message' }])

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    expect(events[events.length - 1]).toBe('finished:settled')
    for (const participantId of ['shape', 'compression', 'story-editor']) {
      expect(events.indexOf(`state:${participantId}:working`)).toBeLessThan(events.indexOf(`settled:${participantId}`))
    }

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed).toHaveLength(4)
    expect(landed.filter((entry) => entry.kind === 'participantNoComment')).toHaveLength(1)
    expect(landed.filter((entry) => entry.kind === 'participantResponse')).toHaveLength(2)
  })

  it('records a response as the room reads it: the claim and the note as said, and a note of nothing but space as no note at all', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: '  the entry is late  ', note: ' \n  ' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'it holds', note: '  by a paragraph  ' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    const landed = entries(dataRoot, workspaceDir, piece.id, 'c1').filter((entry) => entry.kind === 'participantResponse')
    const withoutNote = landed.find((entry) => entry.participantId === 'shape')
    expect(withoutNote).toMatchObject({ claim: 'the entry is late' })
    expect(withoutNote !== undefined && 'note' in withoutNote).toBe(false)
    expect(landed.find((entry) => entry.participantId === 'compression')).toMatchObject({ claim: 'it holds', note: 'by a paragraph' })
  })

  it('records a claim of nothing but space as a nonconforming answer carrying what came back, never as a response with nothing in it', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: '   ' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    const landed = entries(dataRoot, workspaceDir, piece.id, 'c1')
    expect(landed.filter((entry) => entry.kind === 'participantResponse').map((entry) => entry.participantId)).toEqual(['story-editor'])
    expect(landed.find((entry) => entry.kind === 'participantFailure')).toMatchObject({
      participantId: 'shape',
      reason: 'nonconforming',
      returned: '{"outcome":"commentary","claim":"   "}',
    })
  })

  it('stamps every participant it calls with a start moment from its own clock, carried unchanged from called through preparing into working', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, states: ['preparing', 'working'] },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, states: ['preparing', 'working'] },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, states: ['preparing', 'working'] },
    })

    const activity: ParticipantActivityEvent[] = []
    room.subscribe(piece.id, (event) => {
      if (event.type === 'participant.activity') activity.push(event.data)
    })

    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    for (const participantId of ['shape', 'compression', 'story-editor']) {
      const own = activity.filter((event) => event.participantId === participantId)
      expect(own.map((event) => event.state)).toEqual(['called', 'preparing', 'working'])
      expect(own.every((event) => event.startedAt === 1_700_000_000_000)).toBe(true)
    }
  })

  it('submits every eligible specialist independently, settles them in completion order rather than cast order, and calls the Story Editor only once this dispatch\'s own specialist set is empty', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'shape reading' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'compression reading' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const settled = untilIdle(room, piece.id)

    expect(adapter.promptFor('shape')).toBeDefined()
    expect(adapter.promptFor('compression')).toBeDefined()

    const compressionLanded = nextEntryAppended(room, piece.id, 'compression')
    adapter.release('compression')
    await compressionLanded
    expect(adapter.promptFor('story-editor')).toBeUndefined()

    const shapeLanded = nextEntryAppended(room, piece.id, 'shape')
    adapter.release('shape')
    await shapeLanded
    await vi.waitFor(() => expect(adapter.promptFor('story-editor')).toBeDefined())

    adapter.release('story-editor')
    await settled

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId).filter((entry) => entry.kind === 'participantResponse')
    expect(landed.map((entry) => entry.participantId)).toEqual(['compression', 'shape', 'story-editor'])
  })

  it("builds every specialist's prompt before any of this dispatch's specialists settle, so a specialist's prompt never carries a sibling's reading from the same dispatch", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'shape reading' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'compression reading' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const settled = untilIdle(room, piece.id)

    const shapePrompt = adapter.promptFor('shape')
    const compressionPrompt = adapter.promptFor('compression')
    expect(shapePrompt).not.toContain('compression reading')
    expect(compressionPrompt).not.toContain('shape reading')

    const compressionLanded = nextEntryAppended(room, piece.id, 'compression')
    adapter.release('compression')
    await compressionLanded

    const shapeLanded = nextEntryAppended(room, piece.id, 'shape')
    adapter.release('shape')
    await shapeLanded
    await vi.waitFor(() => expect(adapter.promptFor('story-editor')).toBeDefined())

    expect(adapter.promptFor('shape')).toBe(shapePrompt)
    expect(adapter.promptFor('compression')).toBe(compressionPrompt)

    adapter.release('story-editor')
    await settled
  })

  it('durably enables a specialist addressed from outside the enabled cast, naming it as brought — and brings nobody where addressing names only the cast', async () => {
    const brought = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    await pieceMetadata.writeCast(workspaceDir, brought.id, 'draft', ['compression'])
    const alreadyIn = await createPiece(pieceMetadata, workspaceDir, 'Kettle', MODE_FIXTURE.id, FIXTURE_CATALOG)

    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } } },
    })

    await dispatch(room, workspaceDir, scope(brought.id), 'c1', { kind: 'message', text: '@shape a direct question' }, documents('draft text'))
    await untilIdle(room, brought.id)

    expect(readPiece(workspaceDir, brought.id)?.metadata.cast.draft.sort()).toEqual(['compression', 'shape'])
    expect(entries(dataRoot, workspaceDir, brought.id, 'c1')[0]).toMatchObject({ kind: 'authorMessage', brought: ['shape'] })

    await dispatch(room, workspaceDir, scope(alreadyIn.id), 'c1', { kind: 'message', text: '@shape a direct question' }, documents('draft text'))
    await untilIdle(room, alreadyIn.id)

    expect(entries(dataRoot, workspaceDir, alreadyIn.id, 'c1')[0]).toMatchObject({ kind: 'authorMessage', brought: [] })
    expect(adapter.promptFor('shape')).toBeDefined()
  })

  it('owes an answer on every dispatch that calls it at all, so the Story Editor cannot decline even where every specialist did', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed.filter((entry) => entry.kind === 'participantNoComment').map((entry) => entry.participantId)).toEqual(['shape', 'compression'])
    expect(landed.filter((entry) => entry.kind === 'participantFailure').map((entry) => entry.participantId)).toEqual(['story-editor'])
    expect(landed.find((entry) => entry.kind === 'participantFailure')).toMatchObject({ reason: 'nonconforming' })
  })

  it('calls a named addressed-only participant alone, enrolling it in nothing and trailing it with no generalist call', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      toolsmith: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a tool reading' } } },
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: '@toolsmith sharpen this' }, documents('draft text'))
    await untilIdle(room, piece.id)

    expect(adapter.promptFor('toolsmith')).toBeDefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
    expect(readPiece(workspaceDir, piece.id)?.metadata.cast.draft.sort()).toEqual(['compression', 'shape'])

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', audience: ['toolsmith'], brought: [] })
    expect(landed.filter((entry) => entry.kind === 'participantResponse').map((entry) => entry.participantId)).toEqual(['toolsmith'])
  })

  it('settles with nothing in it at all when every call failed, without ever emitting an error event', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'unreachable' } },
      'story-editor': { result: { outcome: 'failed', reason: 'nonconforming', returned: 'not json' } },
    })

    const events: string[] = []
    room.subscribe(piece.id, (event) => {
      events.push(event.type)
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    expect(events).not.toContain('error')
    expect(events[events.length - 1]).toBe('action.finished')

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed.filter((entry) => entry.kind === 'participantFailure')).toHaveLength(3)
  })

  it('persists no entry for the participant abandoned mid-call, and leaves it stopped at that point', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, closed } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { conversationId, actionId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const unwound = closed(actionId)
    room.abandon(scope(piece.id), actionId)
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
    await unwound

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed).toEqual([
      { id: expect.any(String), kind: 'authorMessage', text: 'a message', audience: [], brought: [], atMs: expect.any(Number), castSize: expect.any(Number) },
    ])
  })

  it('lets a new dispatch start immediately without waiting for the abandoned one to unwind, and treats the stale actionId as a silent no-op that never touches it', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    const { actionId: firstActionId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'first' }, documents('draft text'))
    room.abandon(scope(piece.id), firstActionId)

    const { conversationId, actionId: secondActionId } = await dispatch(room,
      workspaceDir,
      scope(piece.id),
      'c1',
      { kind: 'message', text: 'second' },
      documents('draft text'),
    )
    expect(secondActionId).not.toBe(firstActionId)
    const settled = untilIdle(room, piece.id)

    room.abandon(scope(piece.id), firstActionId)
    expect(room.activitySnapshot(scope(piece.id))).toMatchObject({ actionId: secondActionId })

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId).filter(
      (entry) => entry.kind === 'participantResponse' || entry.kind === 'participantNoComment',
    )
    expect(landed).toHaveLength(3)
  })

  it('refuses a dispatch naming a conversation the room never handed out and nothing has written, reaching no model and opening no action', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading' } } },
    })

    await expect(
      room.dispatch(workspaceDir, scope(piece.id), 'no-such-conversation', { kind: 'message', text: 'a message' }, documents('draft text')),
    ).rejects.toThrowError(ConversationNotFoundError)

    expect(adapter.promptFor('shape')).toBeUndefined()
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
    expect(entries(dataRoot, workspaceDir, piece.id, 'no-such-conversation')).toEqual([])
  })

  it('refuses a minted id presented in a scope other than the one that minted it, and admits it in the scope that minted it', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    const draftScope = scope(piece.id)
    const storyContextScope: RoomScope = { pieceId: piece.id, surface: 'storyContext' }
    const { id: conversationId } = room.mintConversation(workspaceDir, draftScope)

    await expect(
      room.dispatch(workspaceDir, storyContextScope, conversationId, { kind: 'message', text: 'a message' }, documents('draft text')),
    ).rejects.toThrowError(ConversationNotFoundError)
    expect(adapter.promptFor('shape')).toBeUndefined()

    await room.dispatch(workspaceDir, draftScope, conversationId, { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    expect(entries(dataRoot, workspaceDir, piece.id, conversationId)[0]).toMatchObject({ kind: 'authorMessage', text: 'a message' })
  })

  it('does not let a minted id outlive the piece it was minted for once the room abandons that piece', async () => {
    const pieceOne = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const pieceTwo = await createPiece(pieceMetadata, workspaceDir, 'Saucers', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {})

    room.connect(pieceOne.id, () => {})
    const { id: conversationId } = room.mintConversation(workspaceDir, scope(pieceOne.id))

    room.connect(pieceTwo.id, () => {})

    await expect(
      room.dispatch(workspaceDir, scope(pieceOne.id), conversationId, { kind: 'message', text: 'a message' }, documents('draft text')),
    ).rejects.toThrowError(ConversationNotFoundError)
  })

  it('appends nothing and emits one terminal frame where every model result lands after the abandonment', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter, closed } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })
    const finished: string[] = []
    room.subscribe(piece.id, (event) => {
      if (event.type === 'action.finished') finished.push(event.data.outcome)
    })

    const { conversationId, actionId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const unwound = closed(actionId)
    room.abandon(scope(piece.id), actionId)
    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await unwound

    expect(finished).toEqual(['abandoned'])
    expect(entries(dataRoot, workspaceDir, piece.id, conversationId)).toMatchObject([{ kind: 'authorMessage', text: 'a message' }])
  })

  it('refuses to delete the conversation its scope is working in, and deletes that same conversation once the scope is idle', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const settled = untilIdle(room, piece.id)

    await expect(room.deleteConversation(workspaceDir, scope(piece.id), conversationId)).rejects.toThrowError(RoomBusyError)
    expect(entries(dataRoot, workspaceDir, piece.id, conversationId)).not.toEqual([])

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    await room.deleteConversation(workspaceDir, scope(piece.id), conversationId)
    expect(entries(dataRoot, workspaceDir, piece.id, conversationId)).toEqual([])
  })

  it("resolves an author-context room scope's conversation in the data root's global namespace, not under the piece", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a durable note' } } },
    })

    const authorContextScope: RoomScope = { pieceId: piece.id, surface: 'authorContext' }
    await dispatch(room, workspaceDir, authorContextScope, 'c1', { kind: 'message', text: 'a durable preference' }, documents('draft text'))
    await untilIdleInScope(room, authorContextScope)

    expect(readConversationEntries(dataRoot, { kind: 'global' }, cid(authorContextScope, 'c1'))).toMatchObject({
      entries: [{ kind: 'authorMessage', text: 'a durable preference' }, { kind: 'participantResponse' }],
    })
    expect(readConversationEntries(dataRoot, draftScope(workspaceDir, piece.id), cid(scope(piece.id), 'c1'))).toBeUndefined()
  })

  it("carries the currently open piece's draft, story context and mode description, though the conversation it dispatches into is global", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a durable note' } } },
    })

    const authorContextScope: RoomScope = { pieceId: piece.id, surface: 'authorContext' }
    await dispatch(room,
      workspaceDir,
      authorContextScope,
      'c1',
      { kind: 'message', text: 'what should I remember about this author' },
      documents('the currently open draft text', { storyContext: 'the currently open story-context text' }),
    )
    await untilIdleInScope(room, authorContextScope)

    expect(adapter.promptFor('story-editor')).toContain(MODE_FIXTURE.description)
    expect(adapter.promptFor('story-editor')).toContain('the currently open draft text')
    expect(adapter.promptFor('story-editor')).toContain('the currently open story-context text')
  })

  it("gives the declared interviewer the reference schema for whichever context surface it was called on, and gives it nobody else's call", async () => {
    const interviewerAnswers: Readonly<Record<string, FixtureBehavior>> = {
      [INTERVIEWER_FIXTURE.id]: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'one question' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a durable note' } } },
    }
    const askInterviewer = `@${INTERVIEWER_FIXTURE.handle} ${INTERVIEWER_FIXTURE.function?.invocation}`

    for (const [surface, reference] of [
      ['storyContext', MODE_FIXTURE.storyContextReference],
      ['authorContext', AUTHOR_CONTEXT_REFERENCE_FIXTURE],
    ] as const) {
      const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
      const { room, adapter } = buildRoom(dataRoot, interviewerAnswers)
      const roomScope: RoomScope = { pieceId: piece.id, surface }

      await dispatch(room, workspaceDir, roomScope, 'c1', { kind: 'message', text: askInterviewer }, documents('draft text'))
      await untilIdleInScope(room, roomScope)
      expect(adapter.promptFor(INTERVIEWER_FIXTURE.id)).toContain(reference)

      await dispatch(room, workspaceDir, roomScope, 'c1', { kind: 'message', text: 'an ordinary message' }, documents('draft text'))
      await untilIdleInScope(room, roomScope)
      expect(adapter.promptFor('story-editor')).not.toContain(reference)
    }

    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, interviewerAnswers)

    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: askInterviewer }, documents('draft text'))
    await untilIdle(room, piece.id)

    expect(adapter.promptFor(INTERVIEWER_FIXTURE.id)).not.toContain(MODE_FIXTURE.storyContextReference)
    expect(adapter.promptFor(INTERVIEWER_FIXTURE.id)).not.toContain(AUTHOR_CONTEXT_REFERENCE_FIXTURE)
  })

  it('lets the Story Editor say nothing where a specialist already gave the author something substantive', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed.find((entry) => 'participantId' in entry && entry.participantId === 'story-editor')).toMatchObject({
      kind: 'participantNoComment',
    })
  })

  it('still owes an answer where the author addressed the Story Editor directly', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: '@editor what do you think' }, documents('draft text'))
    await untilIdle(room, piece.id)

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed.find((entry) => 'participantId' in entry && entry.participantId === 'story-editor')).toMatchObject({
      kind: 'participantFailure',
      reason: 'nonconforming',
    })
  })

  it("reaches the Story Editor with the specialists' answers and with no answer from a participant called for its function", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading about shape' } } },
      toolsmith: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading about tooling' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    await dispatch(room,
      workspaceDir,
      scope(piece.id),
      'c1',
      { kind: 'message', text: '@shape @toolsmith @editor a message' },
      documents('draft text'),
    )
    await untilIdle(room, piece.id)

    expect(adapter.promptFor('toolsmith')).toBeDefined()
    expect(adapter.promptFor('story-editor')).toContain('a reading about shape')
    expect(adapter.promptFor('story-editor')).not.toContain('a reading about tooling')
  })

  it('states the response it could not write, keeps the responses beside it, and settles the dispatch', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const adapter = FixtureModelAdapter.bySite(
      {
        shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading about shape' } } },
        compression: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading about compression' } } },
        'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
      },
      { reachable: true, models: [] },
    )
    const room = buildTestRoom(dataRoot, roomSpecWith(adapter, new EntryStoreRefusing('shape')))

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    const { conversationId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await untilIdle(room, piece.id)

    expect(events.find((event) => event.type === 'error')?.data).toMatchObject({
      code: failureCodeSchema.enum.CONVERSATION_NOT_WRITTEN,
      message: "Shape's response was not written to the conversation: the conversation file refused the write",
    })
    expect(events.find((event) => event.type === 'action.finished')?.data).toMatchObject({ outcome: 'settled' })

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed.map((entry) => ('participantId' in entry ? entry.participantId : entry.kind))).toEqual([
      'authorMessage',
      'compression',
      'story-editor',
    ])
  })
})

const STORY_CONTEXT_WITH_A_COMMENT = 'Premise: two cups.\n\n<!-- ask her which cup is chipped -->\n'

describe('Room.apply', () => {
  const UNRESOLVED_EDITS: FixtureBehavior = {
    result: { outcome: 'value', value: { edits: [{ find: 'a line that was never in the draft', replace: 'anything at all' }] } },
  }
  const RESOLVING_EDITS: FixtureBehavior = { result: { outcome: 'value', value: { edits: [{ find: 'draft text', replace: 'revised text' }] } } }

  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-room-apply-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  async function pieceWithRecommendation(): Promise<{ pieceId: string }> {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })
    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'shape', text: 'a direct question' }, documents('draft text'))
    await untilIdle(room, piece.id)
    adapter.release('shape')
    return { pieceId: piece.id }
  }

  function responseId(pieceId: string): string {
    const [response] = entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'participantResponse')
    if (response === undefined) throw new Error('expected a landed response')
    return response.id
  }

  it('produces the manuscript the model returned as a pending application, calling no participant, and writes nothing until confirmed', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: ', twice.', replace: '.' }] } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      scope(pieceId),
      cid(scope(pieceId), 'c1'),
      responseId(pieceId),
      undefined,
      documents('The cups sat where she left them, twice.'),
    )

    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    expect(outcome.replacement).toBe('The cups sat where she left them.')
    expect(adapter.promptFor('shape')).toBeUndefined()
    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(room.activitySnapshot(scope(pieceId))).toMatchObject({ kind: 'apply' })
  })

  it('pends the manuscript in the prose surface\'s own spelling, reading the spliced document in whole rather than each replacement where it stands, so a fragment is never read in as a document of its own', async () => {
    const target = 'She left them there.\n\nTwo cups, both chipped, and a saucer.\n'
    const replacement = '- both of them *chipped* -'
    const spliced = 'She left them there.\n\nTwo cups, - both of them *chipped* -, and a saucer.\n'
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'both chipped', replace: replacement }] } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents(target))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    expect(outcome.replacement).not.toBe(spliced)
    expect(outcome.replacement).toBe(canonicalMarkdown(spliced))
    expect(outcome.replacement).toContain('- both of them')
    await new DraftStore().write(workspaceDir, pieceId, outcome.replacement)
    await expect(room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)).resolves.toMatchObject({ entryId: outcome.applicationId })
  })

  it('answers that nothing changed where the model rewrote the manuscript in another spelling of the same prose', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: '_there_', replace: '*there*' }] } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('She left them _there_.'))

    expect(outcome).toMatchObject({ outcome: 'noChange' })
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it("the activity snapshot names the pending application's own identity once the model has answered, and carries no document", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: ', twice.', replace: '.' }] } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      scope(pieceId),
      cid(scope(pieceId), 'c1'),
      responseId(pieceId),
      undefined,
      documents('The cups sat where she left them, twice.'),
    )
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    const snapshot = room.activitySnapshot(scope(pieceId))
    expect(snapshot).toMatchObject({ kind: 'apply', applicationId: outcome.applicationId })
    expect(snapshot).not.toHaveProperty('manuscript')
  })

  it('retrieves the pending replacement by its provisional identity, and refuses an identity that is not this scope’s pending Apply', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: ', twice.', replace: '.' }] } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      scope(pieceId),
      cid(scope(pieceId), 'c1'),
      responseId(pieceId),
      undefined,
      documents('The cups sat where she left them, twice.'),
    )
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    expect(room.pendingReplacement(scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)).toBe('The cups sat where she left them.')
    expect(() => room.pendingReplacement(scope(pieceId), cid(scope(pieceId), 'c1'), 'no-such-application')).toThrowError(ApplicationNotPendingError)

    await new DraftStore().write(workspaceDir, pieceId, outcome.replacement)
    await room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)

    expect(() => room.pendingReplacement(scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)).toThrowError(ApplicationNotPendingError)
  })

  it("carries the recommendation, the author's constraint and the draft verbatim, beside the full current conversation including discussion after the recommendation", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room: laterRoom } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } } },
    })
    await dispatch(laterRoom, workspaceDir, scope(pieceId), 'c1', { kind: 'message', text: 'a later, unrelated question' }, documents('draft text'))
    await untilIdle(laterRoom, pieceId)

    await writeStoryContext(workspaceDir, pieceId, 'stale story context nobody submitted')
    await writeAuthorContext(dataRoot, 'stale author context nobody submitted')

    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'draft text', replace: 'revised' }] } } },
    })

    await room.apply(
      workspaceDir,
      scope(pieceId),
      cid(scope(pieceId), 'c1'),
      responseId(pieceId),
      'keep the last line',
      documents('draft text', { storyContext: 'submitted story context', authorContext: 'submitted author context' }),
    )

    expect(adapter.promptFor('apply')).toContain('cut the second paragraph')
    expect(adapter.promptFor('apply')).toContain('keep the last line')
    expect(adapter.promptFor('apply')).toContain('submitted story context')
    expect(adapter.promptFor('apply')).toContain('submitted author context')
    expect(adapter.promptFor('apply')).not.toContain('stale story context')
    expect(adapter.promptFor('apply')).not.toContain('stale author context')
    expect(adapter.promptFor('apply')).toContain('draft text')
    expect(adapter.promptFor('apply')).toContain('a later, unrelated question')
  })

  it('refuses when no such applicable suggestion stands at that identity', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {})

    await expect(room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), 'no-such-response', undefined, documents('draft'))).rejects.toThrowError(
      RecommendationNotFoundError,
    )
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('admits one dispatch or application at a time per room scope, and names the piece and surface holding it', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    const [first, second] = await Promise.allSettled([
      dispatch(room, workspaceDir, scope(pieceId), 'c2', { kind: 'message', text: 'first' }, documents('draft text')),
      dispatch(room, workspaceDir, scope(pieceId), 'c2', { kind: 'message', text: 'second' }, documents('draft text')),
    ])
    expect(first?.status).toBe('fulfilled')
    expect(second?.status === 'rejected' && second.reason).toBeInstanceOf(RoomBusyError)
    expect(second?.status === 'rejected' && (second.reason as Error).message).toContain('draft')
    expect(entries(dataRoot, workspaceDir, pieceId, 'c2')).toMatchObject([{ kind: 'authorMessage', text: 'first' }])
    const settled = untilIdle(room, pieceId)

    await expect(room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft'))).rejects.toThrowError(RoomBusyError)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    const { room: applyRoom, adapter: applyAdapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'draft', replace: 'revised' }] } }, held: true },
    })
    const applying = applyRoom.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft'))

    await expect(dispatch(applyRoom, workspaceDir, scope(pieceId), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))).rejects.toThrowError(
      RoomBusyError,
    )

    applyAdapter.release('apply')
    await applying
  })

  it("gates only its own room scope: the same piece's other surface, and a different piece's draft, each accept a dispatch while one scope is busy", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const other = await createPiece(pieceMetadata, workspaceDir, 'Kettle', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
      toolsmith: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a tool reading' } }, held: true },
    })

    await dispatch(room, workspaceDir, scope(pieceId), 'c2', { kind: 'message', text: 'busy on draft' }, documents('draft text'))
    const draftSettled = untilIdle(room, pieceId)

    const storyContextScope: RoomScope = { pieceId, surface: 'storyContext' }
    const { actionId: storyContextActionId } = await dispatch(room,
      workspaceDir,
      storyContextScope,
      'c1',
      { kind: 'message', text: 'a story-context note' },
      documents('draft text'),
    )
    expect(room.activitySnapshot(storyContextScope)).toBeDefined()

    const { actionId: otherActionId } = await dispatch(room,
      workspaceDir,
      scope(other.id),
      'c1',
      { kind: 'targeted', target: 'toolsmith', text: 'a direct question' },
      documents('draft text'),
    )
    expect(room.activitySnapshot(scope(other.id))).toBeDefined()

    room.abandon(storyContextScope, storyContextActionId)
    room.abandon(scope(other.id), otherActionId)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await draftSettled
  })

  it('leaves the recommendation applicable, and the draft as it was, where the application did not settle', async () => {
    const { pieceId } = await pieceWithRecommendation()

    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'draft text', replace: 'revised' }] } }, held: true },
    })
    const events: RoomEvent[] = []
    room.subscribe(pieceId, (event) => events.push(event))

    const applying = room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    const started = events.find((event) => event.type === 'action.started')
    if (started === undefined) throw new Error('expected action.started to have fired synchronously')
    room.abandon(scope(pieceId), started.data.actionId)
    await expect(applying).resolves.toMatchObject({ outcome: { outcome: 'abandoned' } })
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()

    const { room: failing } = buildRoom(dataRoot, { apply: { result: { outcome: 'failed', reason: 'unconfigured' } } })
    const { outcome } = await failing.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    expect(outcome).toMatchObject({ outcome: 'failed', reason: 'unconfigured' })
    expect(failing.activitySnapshot(scope(pieceId))).toBeUndefined()
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()

    adapter.release('apply')
    const retried = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    if (retried.outcome.outcome !== 'pending') throw new Error('expected the retried application to be pending')
    expect(retried.outcome.replacement).toBe('revised')
  })

  it("states the application's own collapse: a seam that throws closes the action at its scope rather than leaving it open", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const broken: ModelAccess = {
      call: () => Promise.reject(new Error('the seam broke in a way nothing named')),
      status: () => Promise.resolve({ reachable: true, models: [] }),
    }
    const room = buildTestRoom(dataRoot, roomSpecWith(broken, new ConversationEntryStore()))

    const events: RoomEvent[] = []
    room.subscribe(pieceId, (event) => events.push(event))

    await expect(room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))).rejects.toThrowError(
      'the seam broke in a way nothing named',
    )

    expect(events.map((event) => event.type)).toEqual(['action.started', 'action.finished'])
    expect(events.find((event) => event.type === 'action.finished')?.data).toMatchObject({ outcome: 'failed' })
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('confirmed against the document as saved, persists the change and the entry that names the response it came from, and frees the scope', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: ', twice.', replace: '.' }] } } },
    })
    const source = responseId(pieceId)

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), source, undefined, documents('The cups sat where she left them, twice.'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    await new DraftStore().write(workspaceDir, pieceId, outcome.replacement)
    const confirmed = await room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)

    const [onDisk] = readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)
    expect(onDisk?.content).toEqual(confirmed.change)
    expect(confirmed.entryId).toBe(outcome.applicationId)

    const [application] = entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')
    expect(application).toMatchObject({ id: outcome.applicationId, responseId: source, changeId: onDisk?.id })
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('carries no change where every edit replaced text with itself, and creates nothing pending or durable', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'unchanged text', replace: 'unchanged text' }] } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('unchanged text'))

    expect(outcome).toMatchObject({ outcome: 'noChange' })
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('corrects an unresolved anchor in a further round, landing the corrected set within one action and one busy window, the correction carrying the first call\'s material and the rejected attempt after it', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, { apply: [UNRESOLVED_EDITS, RESOLVING_EDITS] })
    const events: RoomEvent[] = []
    room.subscribe(pieceId, (event) => events.push(event))

    const { actionId, outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))

    expect(outcome).toMatchObject({ outcome: 'pending', actionId, replacement: 'revised text' })
    expect(events.filter((event) => event.type === 'action.started')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'action.finished')).toHaveLength(0)
    expect(room.activitySnapshot(scope(pieceId))).toMatchObject({ kind: 'apply', actionId })

    const [first, second] = adapter.turnsFor('apply')
    if (first === undefined || second === undefined) throw new Error('expected the room to have called the seam twice')
    expect(second.slice(0, 2)).toEqual(first)
    expect(second.map((turn) => turn.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(second[2]?.content).toContain('a line that was never in the draft')
    expect(second[3]?.content).toContain('FIXTURE_EDIT_UNMATCHED a line that was never in the draft')
  })

  it('lets a single unresolved edit invalidate the whole returned set, saying of its sibling that it resolved and re-asking against the document unchanged', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      apply: [
        {
          result: {
            outcome: 'value',
            value: {
              edits: [
                { find: 'draft', replace: 'reworked' },
                { find: 'a line that was never in the draft', replace: 'anything at all' },
              ],
            },
          },
        },
        RESOLVING_EDITS,
      ],
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))

    expect(outcome).toMatchObject({ outcome: 'pending', replacement: 'revised text' })
    expect(adapter.promptFor('apply')).toContain('FIXTURE_EDIT_RESOLVED draft')
  })

  it('fails as inapplicable once the rounds are exhausted, carrying nothing back — the target document untouched and the recommendation still applicable', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      apply: [UNRESOLVED_EDITS, UNRESOLVED_EDITS, UNRESOLVED_EDITS, RESOLVING_EDITS],
    })

    const { actionId, outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))

    expect(outcome).toEqual({ outcome: 'failed', actionId, reason: 'inapplicable' })
    expect(adapter.turnsFor('apply')).toHaveLength(3)
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()

    const retried = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    expect(retried.outcome).toMatchObject({ outcome: 'pending', replacement: 'revised text' })
  })

  it('abandoned while a correction round is in flight, cancels that round, leaves the document untouched and frees the scope', async () => {
    const { pieceId } = await pieceWithRecommendation()
    let calls = 0
    const adapter = FixtureModelAdapter.bySite({ apply: [UNRESOLVED_EDITS, { ...RESOLVING_EDITS, held: true }] }, { reachable: true, models: [] }, () => {
      calls += 1
    })
    const room = buildTestRoom(dataRoot, roomSpecWith(adapter, new ConversationEntryStore()))
    const events: RoomEvent[] = []
    room.subscribe(pieceId, (event) => events.push(event))

    const applying = room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    await vi.waitFor(() => {
      if (calls < 2) throw new Error('the correction round has not begun')
    })
    const started = events.find((event) => event.type === 'action.started')
    if (started === undefined) throw new Error('expected action.started to have fired')
    room.abandon(scope(pieceId), started.data.actionId)

    await expect(applying).resolves.toMatchObject({ outcome: { outcome: 'abandoned' } })
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('ends on a timed-out correction round as the failed call it is, rather than spending the rounds that remain', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, { apply: [UNRESOLVED_EDITS, { result: { outcome: 'failed', reason: 'timeout' } }, RESOLVING_EDITS] })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))

    expect(outcome).toMatchObject({ outcome: 'failed', reason: 'timeout' })
    expect(adapter.turnsFor('apply')).toHaveLength(2)
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('logs a round that did not resolve as its number and a count of each diagnosis, and never an anchor, a replacement or a span of the document', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const lines: string[] = []
    const adapter = FixtureModelAdapter.bySite({ apply: [UNRESOLVED_EDITS, RESOLVING_EDITS] }, { reachable: true, models: [] })
    const room = buildTestRoom(dataRoot, {
      ...roomSpecWith(adapter, new ConversationEntryStore()),
      logger: pino({ level: 'info' }, { write: (line: string) => lines.push(line) }),
    })

    await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))

    const logged = lines.map((line) => JSON.parse(line))
    expect(logged.filter((line) => line.msg === 'application edits did not resolve')).toEqual([
      expect.objectContaining({ round: 1, diagnoses: { unmatched: 1 } }),
    ])
    expect(lines.join('')).not.toContain('a line that was never in the draft')
    expect(lines.join('')).not.toContain('anything at all')
    expect(lines.join('')).not.toContain('draft text')
  })

  it('refuses confirmation as not-pending for an unknown identity, and as document-not-saved while the target does not yet match — either refusal records nothing but frees the scope for a fresh application', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'draft text', replace: 'revised text' }] } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    await expect(room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), 'no-such-application')).rejects.toThrowError(ApplicationNotPendingError)

    await expect(room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)).rejects.toThrowError(
      ApplicationDocumentNotSavedError,
    )
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()

    const retried = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    expect(retried.outcome.outcome).toBe('pending')
  })

  it('refuses to confirm an emptying application against a document that is not there, rather than reading absence as an empty document that matches it', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'draft text', replace: '' }] } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    expect(outcome.replacement).toBe('')
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()

    await expect(room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)).rejects.toThrowError(
      ApplicationDocumentNotSavedError,
    )
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
  })

  it('confirms an emptying application once the empty document is actually there, so an empty document is not an absent one', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'draft text', replace: '' }] } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    await new DraftStore().write(workspaceDir, pieceId, outcome.replacement)

    await expect(room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)).resolves.toMatchObject({
      entryId: outcome.applicationId,
    })
  })

  it('confirming an already-committed identity a second time is a no-op that answers with what it already committed', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'draft text', replace: 'revised text' }] } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), responseId(pieceId), undefined, documents('draft text'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    await new DraftStore().write(workspaceDir, pieceId, outcome.replacement)

    const first = await room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)
    const second = await room.confirmApply(workspaceDir, scope(pieceId), cid(scope(pieceId), 'c1'), outcome.applicationId)

    expect(second).toEqual(first)
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toHaveLength(1)
  })

  it("on the story context surface, targets story context rather than the draft: the prompt carries it verbatim with its own reference schema, the text the edit did not quote survives byte for byte, and the confirmed change lands under story context's own conversation, never the draft's", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const storyContextScope: RoomScope = { pieceId: piece.id, surface: 'storyContext' }
    const storyContextConversationScope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'storyContext' }

    const { room: settingUp } = buildRoom(dataRoot, {
      'story-editor': { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'name the second cup' } } },
    })
    await dispatch(settingUp,
      workspaceDir,
      storyContextScope,
      'c1',
      { kind: 'targeted', target: 'story-editor', text: 'what should the story context say' },
      documents('the draft, untouched', { storyContext: STORY_CONTEXT_WITH_A_COMMENT }),
    )
    await untilIdleInScope(settingUp, storyContextScope)

    const [response] = (readConversationEntries(dataRoot, storyContextConversationScope, cid(storyContextScope, 'c1'))?.entries ?? []).filter(
      (entry) => entry.kind === 'participantResponse',
    )
    if (response === undefined) throw new Error('expected a landed response')

    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { edits: [{ find: 'two cups.', replace: 'two cups, one chipped.' }] } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      storyContextScope,
      cid(storyContextScope, 'c1'),
      response.id,
      undefined,
      documents('the draft, untouched', { storyContext: STORY_CONTEXT_WITH_A_COMMENT }),
    )
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    expect(outcome.replacement).toBe('Premise: two cups, one chipped.\n\n<!-- ask her which cup is chipped -->\n')

    expect(adapter.promptFor('apply')).toContain('Premise: two cups.')
    expect(adapter.promptFor('apply')).toContain(MODE_FIXTURE.storyContextReference)

    await writeStoryContext(workspaceDir, piece.id, outcome.replacement)
    const confirmed = await room.confirmApply(workspaceDir, storyContextScope, cid(storyContextScope, 'c1'), outcome.applicationId)

    const [onDisk] = readAppliedChanges(dataRoot, storyContextConversationScope, appliedChangeSchema)
    expect(onDisk?.content).toEqual(confirmed.change)
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, piece.id), appliedChangeSchema)).toEqual([])
    expect(readPiece(workspaceDir, piece.id)?.draft).toBeUndefined()
  })
})

describe('Room.dispatch — an action the author opened from a particular response', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-room-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('replying addresses the named participant by the act, reading the message for nothing', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'shape', text: 'say more about that, @compression' }, documents('draft text'))
    await untilIdle(room, piece.id)

    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('shape')).toContain('say more about that, @compression')

    const landed = entries(dataRoot, workspaceDir, piece.id, 'c1')
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', audience: ['shape'], text: 'say more about that, @compression' })
  })

  it('refuses an act naming a participant or a response that is not there, opening no action either way', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room } = buildRoom(dataRoot, {})

    await expect(
      dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'no-such-participant', text: 'a reply' }, documents('draft text')),
    ).rejects.toThrowError(ParticipantNotFoundError)
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()

    await expect(
      dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'ask', respondingTo: 'no-such-response', clarification: undefined }, documents('draft text')),
    ).rejects.toThrowError(CommentaryNotFoundError)
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
  })

  it("asking for a concrete change opens a dispatch with no message, calling only the response's own participant", async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'The entry is late.', note: 'By a paragraph.' } } },
    })
    await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'shape', text: 'does the opening earn its length' }, documents('draft text'))
    await untilIdle(room, piece.id)
    const [firstResponse] = entries(dataRoot, workspaceDir, piece.id, 'c1').filter((entry) => entry.kind === 'participantResponse')
    if (firstResponse === undefined) throw new Error('expected a landed response')

    const { room: askRoom, adapter: askAdapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the aside' } } },
    })

    const events: RoomEvent[] = []
    askRoom.subscribe(piece.id, (event) => events.push(event))

    await dispatch(askRoom, workspaceDir, scope(piece.id), 'c1', { kind: 'ask', respondingTo: firstResponse.id, clarification: 'what would you cut' }, documents('draft text'))
    await untilIdle(askRoom, piece.id)

    const started = events.find((event) => event.type === 'action.started')
    expect(started?.type === 'action.started' && started.data.kind === 'dispatch' && started.data.audience).toEqual(['shape'])

    expect(askAdapter.promptFor('shape')).toContain('The entry is late.')
    expect(askAdapter.promptFor('shape')).toContain('what would you cut')
    expect(askAdapter.promptFor('compression')).toBeUndefined()
    expect(askAdapter.promptFor('story-editor')).toBeUndefined()

    const landed = entries(dataRoot, workspaceDir, piece.id, 'c1')
    const request = landed.find((entry) => entry.kind === 'concreteChangeRequest')
    expect(request).toMatchObject({ target: 'shape', respondingTo: firstResponse.id, clarification: 'what would you cut' })
  })
})

describe('Room.connect', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-room-connect-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('captures the action in flight, if any, at each of the three room scopes atomically with the subscription, before any live event can arrive', async () => {
    const piece = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { actionId } = await dispatch(room, workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))

    const events: RoomEvent[] = []
    const { snapshot, unsubscribe } = room.connect(piece.id, (event) => events.push(event))

    expect(snapshot.draft).toMatchObject({ actionId, kind: 'dispatch' })
    expect(snapshot.storyContext).toBeNull()
    expect(snapshot.authorContext).toBeNull()
    expect(events).toEqual([])

    unsubscribe()
    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await untilIdle(room, piece.id)
  })

  it("abandons a different piece's unfinished work across all three of its room scopes on opening this one, and resumes a piece's own work untouched on reconnecting to it", async () => {
    const first = await createPiece(pieceMetadata, workspaceDir, 'Cups', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const second = await createPiece(pieceMetadata, workspaceDir, 'Kettle', MODE_FIXTURE.id, FIXTURE_CATALOG)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    room.connect(first.id, () => {})
    await dispatch(room, workspaceDir, scope(first.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const authorContextScope: RoomScope = { pieceId: first.id, surface: 'authorContext' }
    await dispatch(room, workspaceDir, authorContextScope, 'c2', { kind: 'message', text: 'a durable note' }, documents('draft text'))
    const draftSettled = untilIdleInScope(room, scope(first.id))
    const authorContextSettled = untilIdleInScope(room, authorContextScope)

    room.connect(second.id, () => {})

    expect(room.activitySnapshot(scope(first.id))).toBeUndefined()
    expect(room.activitySnapshot(authorContextScope)).toBeUndefined()
    await draftSettled
    await authorContextSettled

    const secondScope = scope(second.id)
    const secondDispatch = await dispatch(room, workspaceDir, secondScope, 'c1', { kind: 'message', text: 'another message' }, documents('draft text'))
    room.connect(second.id, () => {})
    expect(room.activitySnapshot(secondScope)).toMatchObject({ actionId: secondDispatch.actionId })

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await untilIdle(room, second.id)
  })
})
