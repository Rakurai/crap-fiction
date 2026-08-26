import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelAccess } from '../../../src/server/model/types.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece } from '../../../src/server/pieces.js'
import type { ConversationScope, RoomScope } from '../../../src/server/scope.js'
import {
  DraftStore,
  readAppliedChanges,
  readConversationEntries,
  readPiece,
  TolerantReadError,
  writeAuthorContext,
  writePieceCast,
  writeStoryContext,
} from '../../../src/server/store/index.js'
import { appliedChangeSchema } from '../../../src/shared/appliedChange.js'
import type { ConversationEntry } from '../../../src/shared/conversationEntries.js'
import type { DocumentSnapshot } from '../../../src/shared/surfaces.js'
import {
  ApplicationDocumentNotSavedError,
  ApplicationNotPendingError,
  CommentaryNotFoundError,
  ParticipantNotFoundError,
  RecommendationNotFoundError,
  Room,
  RoomBusyError,
  type RoomEvent,
} from '../../../src/server/room/room.js'
import { SHIPPED_HISTORY_POLICY } from '../../../src/server/room/context.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../../support/modelAdapter.js'
import { buildTestRoom } from '../../support/room.js'
import { AUTHOR_CONTEXT_REFERENCE_FIXTURE, CHARTER_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../../support/roomFixtures.js'

const fixtureMode: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in one sitting.',
  storyContextReference: 'Sections, each holding entries.',
}

const fixtureRoles: readonly RoleDefinition[] = [
  {
    id: 'shape',
    handle: 'shape',
    displayName: 'Shape',
    description: 'x',
    persona: 'reasons about x',
    eligibility: 'cast',
    availability: [{ mode: fixtureMode.id, surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'compression',
    handle: 'compression',
    displayName: 'Compression',
    description: 'y',
    persona: 'reasons about y',
    eligibility: 'cast',
    availability: [{ mode: fixtureMode.id, surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'interiority',
    handle: 'interiority',
    displayName: 'Interiority',
    description: 'v',
    persona: 'reasons about v',
    eligibility: 'cast',
    availability: [{ mode: 'novella', surface: 'draft', enabledByDefault: true }],
  },
  {
    id: 'story-editor',
    handle: 'editor',
    displayName: 'Story Editor',
    description: 'z',
    persona: 'reasons about z',
    eligibility: 'generalist',
    availability: [],
  },
  {
    id: 'toolsmith',
    handle: 'toolsmith',
    displayName: 'Toolsmith',
    description: 'w',
    persona: 'reasons about w',
    eligibility: 'addressed-only',
    availability: [],
  },
]

const fixtureSpecialists: readonly RoleDefinition[] = fixtureRoles.filter((role) => role.eligibility === 'cast')

/** Everything a room turns on except the seam under test, which each caller supplies. */
function roomSpecWith(modelAccess: ModelAccess) {
  return {
    modes: [fixtureMode],
    roles: fixtureRoles,
    charter: CHARTER_FIXTURE,
    fragments: PROMPT_FRAGMENTS_FIXTURE,
    policy: SHIPPED_HISTORY_POLICY,
    modelAccess,
    now: () => 1_700_000_000_000,
    authorContextReference: AUTHOR_CONTEXT_REFERENCE_FIXTURE,
  }
}

function buildRoom(dataRoot: string, behaviors: Readonly<Record<string, FixtureBehavior>>): { room: Room; adapter: FixtureModelAdapter } {
  const adapter = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
  const room = buildTestRoom(dataRoot, roomSpecWith(adapter))
  return { room, adapter }
}

function scope(pieceId: string): RoomScope {
  return { pieceId, surface: 'draft' }
}

/** The closed snapshot a dispatch or an Apply carries; most scenarios care only about the draft. */
function documents(draft: string, overrides: Partial<DocumentSnapshot> = {}): DocumentSnapshot {
  return { draft, storyContext: '', authorContext: '', ...overrides }
}

function draftScope(workspaceDir: string, pieceId: string): ConversationScope {
  return { kind: 'piece', workspaceDir, pieceId, surface: 'draft' }
}

function entries(dataRoot: string, workspaceDir: string, pieceId: string, conversationId: string): readonly ConversationEntry[] {
  return readConversationEntries(dataRoot, draftScope(workspaceDir, pieceId), conversationId)?.entries ?? []
}

function settlementOf(room: Room, pieceId: string): Promise<void> {
  return settlementOfScope(room, scope(pieceId))
}

function settlementOfScope(room: Room, roomScope: RoomScope): Promise<void> {
  const settlement = room.settlement(roomScope)
  if (settlement === undefined) throw new Error(`no dispatch in flight for "${roomScope.pieceId}" on its "${roomScope.surface}" surface`)
  return settlement
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
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    // Only a hand-edited piece.yaml can name an unavailable specialist; the pieces module refuses to.
    await writePieceCast(workspaceDir, piece.id, 'draft', ['shape', 'compression', 'interiority'])
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    const { conversationId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await settlementOf(room, piece.id)

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', text: 'a message', audience: [] })
    expect(landed.filter((entry) => entry.kind === 'participantResponse')).toHaveLength(2)
    expect(adapter.promptFor('shape')).toContain('a message')
    expect(adapter.promptFor('interiority')).toBeUndefined()
  })

  it('states a failure synchronously, rather than opening an action, when the conversation on disk cannot be read', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    mkdirSync(path.join(workspaceDir, piece.id, 'conversations', 'draft'), { recursive: true })
    writeFileSync(path.join(workspaceDir, piece.id, 'conversations', 'draft', 'c1.json'), '{ not valid json', 'utf8')
    const { room } = buildRoom(dataRoot, {})

    await expect(room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))).rejects.toThrowError(
      TolerantReadError,
    )
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
  })

  it('reaches a compiled prompt exactly as submitted, comments and malformed YAML alike, since story context is opaque text — and never as reread from disk', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    // Written to disk to prove it is not what reaches the prompt: the submitted snapshot is.
    await writeStoryContext(workspaceDir, piece.id, 'stale text nobody submitted')
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    await room.dispatch(
      workspaceDir,
      scope(piece.id),
      'c1',
      { kind: 'message', text: 'a message' },
      documents('draft text', { storyContext: '# notes\nPremise: not valid: [yaml\n' }),
    )
    await settlementOf(room, piece.id)

    expect(adapter.promptFor('shape')).toContain('# notes\nPremise: not valid: [yaml')
    expect(adapter.promptFor('shape')).not.toContain('stale text nobody submitted')
  })

  it("owns the dispatch's own collapse: a seam that throws instead of failing closes the action and is stated, not rethrown into nothing", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const broken: ModelAccess = {
      call: () => Promise.reject(new Error('the seam broke in a way nothing named')),
      status: () => Promise.resolve({ reachable: true, models: [] }),
    }
    const room = buildTestRoom(dataRoot, roomSpecWith(broken))

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))

    await expect(settlementOf(room, piece.id)).resolves.toBeUndefined()

    expect(events.map((event) => event.type)).toEqual(['action.started', 'entry.appended', 'error', 'action.finished'])
    expect(events.find((event) => event.type === 'error')?.data).toMatchObject({
      code: 'UNEXPECTED_FAILURE',
      message: 'the seam broke in a way nothing named',
    })
    expect(events.find((event) => event.type === 'action.finished')?.data).toMatchObject({ outcome: 'failed' })

    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
  })

  it('writes the author entry before any participant is called, then appends each response as it lands, reporting each as working first', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
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

    const { conversationId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const settled = settlementOf(room, piece.id)
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

  it('submits every eligible specialist independently, settles them in completion order rather than cast order, and calls the Story Editor only once this dispatch\'s own specialist set is empty', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'shape reading' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'compression reading' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    const { conversationId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const settled = settlementOf(room, piece.id)

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

  it('durably enables a specialist addressed from outside the enabled cast, naming it as brought — and brings nobody where addressing names only the cast', async () => {
    const brought = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    await writePieceCast(workspaceDir, brought.id, 'draft', ['compression'])
    const alreadyIn = await createPiece(workspaceDir, 'Kettle', fixtureMode.id, [fixtureMode], fixtureSpecialists)

    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } } },
    })

    await room.dispatch(workspaceDir, scope(brought.id), 'c1', { kind: 'message', text: '@shape a direct question' }, documents('draft text'))
    await settlementOf(room, brought.id)

    expect(readPiece(workspaceDir, brought.id)?.metadata.cast.draft.sort()).toEqual(['compression', 'shape'])
    expect(entries(dataRoot, workspaceDir, brought.id, 'c1')[0]).toMatchObject({ kind: 'authorMessage', brought: ['shape'] })

    await room.dispatch(workspaceDir, scope(alreadyIn.id), 'c1', { kind: 'message', text: '@shape a direct question' }, documents('draft text'))
    await settlementOf(room, alreadyIn.id)

    expect(entries(dataRoot, workspaceDir, alreadyIn.id, 'c1')[0]).toMatchObject({ kind: 'authorMessage', brought: [] })
    expect(adapter.promptFor('shape')).toBeDefined()
  })

  it('calls a named addressed-only participant alone, enrolling it in nothing and trailing it with no generalist call', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      toolsmith: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a tool reading' } } },
    })

    const { conversationId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: '@toolsmith sharpen this' }, documents('draft text'))
    await settlementOf(room, piece.id)

    expect(adapter.promptFor('toolsmith')).toBeDefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
    expect(readPiece(workspaceDir, piece.id)?.metadata.cast.draft.sort()).toEqual(['compression', 'shape'])

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', audience: ['toolsmith'], brought: [] })
    expect(landed.filter((entry) => entry.kind === 'participantResponse').map((entry) => entry.participantId)).toEqual(['toolsmith'])
  })

  it('settles with nothing in it at all when every call failed, without ever emitting an error event', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'unreachable' } },
      'story-editor': { result: { outcome: 'failed', reason: 'nonconforming', returned: 'not json' } },
    })

    const events: string[] = []
    room.subscribe(piece.id, (event) => {
      events.push(event.type)
    })

    const { conversationId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    await settlementOf(room, piece.id)

    expect(events).not.toContain('error')
    expect(events[events.length - 1]).toBe('action.finished')

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed.filter((entry) => entry.kind === 'participantFailure')).toHaveLength(3)
  })

  it('persists no entry for the participant abandoned mid-call, and leaves it stopped at that point', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { conversationId, actionId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const settled = settlementOf(room, piece.id)
    room.abandon(scope(piece.id), actionId)
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
    await settled

    const landed = entries(dataRoot, workspaceDir, piece.id, conversationId)
    expect(landed).toEqual([{ id: expect.any(String), kind: 'authorMessage', text: 'a message', audience: [], brought: [] }])
  })

  it('ABANDON-UNTRACK: lets a new dispatch start immediately without waiting for the abandoned one to unwind, and treats the stale actionId as a silent no-op that never touches it', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    const { actionId: firstActionId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'first' }, documents('draft text'))
    room.abandon(scope(piece.id), firstActionId)

    const { conversationId, actionId: secondActionId } = await room.dispatch(
      workspaceDir,
      scope(piece.id),
      'c1',
      { kind: 'message', text: 'second' },
      documents('draft text'),
    )
    expect(secondActionId).not.toBe(firstActionId)
    const settled = settlementOf(room, piece.id)

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

  it("resolves an author-context room scope's conversation in the data root's global namespace, not under the piece", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room } = buildRoom(dataRoot, {
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a durable note' } } },
    })

    const authorContextScope: RoomScope = { pieceId: piece.id, surface: 'authorContext' }
    await room.dispatch(workspaceDir, authorContextScope, 'c1', { kind: 'message', text: 'a durable preference' }, documents('draft text'))
    await settlementOfScope(room, authorContextScope)

    expect(readConversationEntries(dataRoot, { kind: 'global' }, 'c1')).toMatchObject({
      entries: [{ kind: 'authorMessage', text: 'a durable preference' }, { kind: 'participantResponse' }],
    })
    expect(readConversationEntries(dataRoot, draftScope(workspaceDir, piece.id), 'c1')).toBeUndefined()
  })

  it("carries the currently open piece's draft, story context and mode description, though the conversation it dispatches into is global", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a durable note' } } },
    })

    const authorContextScope: RoomScope = { pieceId: piece.id, surface: 'authorContext' }
    await room.dispatch(
      workspaceDir,
      authorContextScope,
      'c1',
      { kind: 'message', text: 'what should I remember about this author' },
      documents('the currently open draft text', { storyContext: 'the currently open story-context text' }),
    )
    await settlementOfScope(room, authorContextScope)

    expect(adapter.promptFor('story-editor')).toContain(fixtureMode.description)
    expect(adapter.promptFor('story-editor')).toContain('the currently open draft text')
    expect(adapter.promptFor('story-editor')).toContain('the currently open story-context text')
  })
})

describe('Room.apply', () => {
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
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })
    await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'shape', text: 'a direct question' }, documents('draft text'))
    await settlementOf(room, piece.id)
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
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      scope(pieceId),
      'c1',
      responseId(pieceId),
      undefined,
      documents('The cups sat where she left them, twice.'),
    )

    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    expect(outcome.manuscript).toBe('The cups sat where she left them.')
    expect(adapter.promptFor('shape')).toBeUndefined()
    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(room.activitySnapshot(scope(pieceId))).toMatchObject({ kind: 'apply' })
  })

  it("the activity snapshot names the pending application's own identity once the model has answered, and carries no document", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      scope(pieceId),
      'c1',
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
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      scope(pieceId),
      'c1',
      responseId(pieceId),
      undefined,
      documents('The cups sat where she left them, twice.'),
    )
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    expect(room.pendingReplacement(scope(pieceId), 'c1', outcome.applicationId)).toBe('The cups sat where she left them.')
    expect(() => room.pendingReplacement(scope(pieceId), 'c1', 'no-such-application')).toThrowError(ApplicationNotPendingError)

    await new DraftStore().write(workspaceDir, pieceId, outcome.manuscript)
    await room.confirmApply(workspaceDir, scope(pieceId), 'c1', outcome.applicationId)

    // Committed rather than pending: the identity now names a durable application, not this
    // retrieval, which answers only the scope's own in-memory pending state.
    expect(() => room.pendingReplacement(scope(pieceId), 'c1', outcome.applicationId)).toThrowError(ApplicationNotPendingError)
  })

  it("carries the recommendation, the author's constraint and the draft verbatim, beside the full current conversation including discussion after the recommendation", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room: laterRoom } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } } },
    })
    await laterRoom.dispatch(workspaceDir, scope(pieceId), 'c1', { kind: 'message', text: 'a later, unrelated question' }, documents('draft text'))
    await settlementOf(laterRoom, pieceId)

    // Written to disk to prove it is not what reaches the prompt: the submitted snapshot is.
    await writeStoryContext(workspaceDir, pieceId, 'stale story context nobody submitted')
    await writeAuthorContext(dataRoot, 'stale author context nobody submitted')

    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } } },
    })

    await room.apply(
      workspaceDir,
      scope(pieceId),
      'c1',
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

    await expect(room.apply(workspaceDir, scope(pieceId), 'c1', 'no-such-response', undefined, documents('draft'))).rejects.toThrowError(
      RecommendationNotFoundError,
    )
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  /**
   * One conversation-action state per room scope: a piece's surface stays busy until its
   * dispatch or application settles, and neither act starts a second one at that same scope.
   */
  it('admits one dispatch or application at a time per room scope, and names the piece and surface holding it', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    // Two dispatches issued in the same tick for the same scope: only the first ever opens.
    const [first, second] = await Promise.allSettled([
      room.dispatch(workspaceDir, scope(pieceId), 'c2', { kind: 'message', text: 'first' }, documents('draft text')),
      room.dispatch(workspaceDir, scope(pieceId), 'c2', { kind: 'message', text: 'second' }, documents('draft text')),
    ])
    expect(first?.status).toBe('fulfilled')
    expect(second?.status === 'rejected' && second.reason).toBeInstanceOf(RoomBusyError)
    expect(second?.status === 'rejected' && (second.reason as Error).message).toContain('draft')
    expect(entries(dataRoot, workspaceDir, pieceId, 'c2')).toMatchObject([{ kind: 'authorMessage', text: 'first' }])
    const settled = settlementOf(room, pieceId)

    // The same scope also refuses an application while its dispatch is in flight.
    await expect(room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft'))).rejects.toThrowError(RoomBusyError)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    // And the other way round: an application in flight refuses a second dispatch at its own scope.
    const { room: applyRoom, adapter: applyAdapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })
    const applying = applyRoom.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft'))

    await expect(applyRoom.dispatch(workspaceDir, scope(pieceId), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))).rejects.toThrowError(
      RoomBusyError,
    )

    applyAdapter.release('apply')
    await applying
  })

  it("gates only its own room scope: the same piece's other surface, and a different piece's draft, each accept a dispatch while one scope is busy", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const other = await createPiece(workspaceDir, 'Kettle', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    // Addressed at a distinct, addressed-only participant so its held call cannot collide with the
    // busy scope's own held calls to `shape` and `compression` at the fixture adapter's one gate per site.
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
      toolsmith: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a tool reading' } }, held: true },
    })

    await room.dispatch(workspaceDir, scope(pieceId), 'c2', { kind: 'message', text: 'busy on draft' }, documents('draft text'))
    const draftSettled = settlementOf(room, pieceId)

    // The same piece's story-context surface is a different room scope, and accepts a dispatch of its
    // own rather than being refused as busy. Nothing is available there, so this calls only the Story
    // Editor — not yet submitted for the busy draft scope, so its held call cannot collide either.
    const storyContextScope: RoomScope = { pieceId, surface: 'storyContext' }
    const { actionId: storyContextActionId } = await room.dispatch(
      workspaceDir,
      storyContextScope,
      'c1',
      { kind: 'message', text: 'a story-context note' },
      documents('draft text'),
    )
    expect(room.activitySnapshot(storyContextScope)).toBeDefined()

    // And a different piece's draft surface, a different scope again, accepts one too.
    const { actionId: otherActionId } = await room.dispatch(
      workspaceDir,
      scope(other.id),
      'c1',
      { kind: 'targeted', target: 'toolsmith', text: 'a direct question' },
      documents('draft text'),
    )
    expect(room.activitySnapshot(scope(other.id))).toBeDefined()

    // Neither newly accepted scope waited on the busy one, which is the property under test; abandon
    // them rather than releasing their held call twice over.
    room.abandon(storyContextScope, storyContextActionId)
    room.abandon(scope(other.id), otherActionId)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await draftSettled
  })

  it('leaves the recommendation applicable, and the draft as it was, where the application did not settle', async () => {
    const { pieceId } = await pieceWithRecommendation()

    // Abandoned mid-call.
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })
    const events: RoomEvent[] = []
    room.subscribe(pieceId, (event) => events.push(event))

    const applying = room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft text'))
    const started = events.find((event) => event.type === 'action.started')
    if (started === undefined) throw new Error('expected action.started to have fired synchronously')
    room.abandon(scope(pieceId), started.data.actionId)
    await expect(applying).resolves.toMatchObject({ outcome: { outcome: 'abandoned' } })
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()

    // Failed outright.
    const { room: failing } = buildRoom(dataRoot, { apply: { result: { outcome: 'failed', reason: 'unconfigured' } } })
    const { outcome } = await failing.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft text'))
    expect(outcome).toMatchObject({ outcome: 'failed', reason: 'unconfigured' })
    expect(failing.activitySnapshot(scope(pieceId))).toBeUndefined()
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()

    // The recommendation still stands at its identity, so a later application opens pending again.
    adapter.release('apply')
    const retried = await room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft text'))
    if (retried.outcome.outcome !== 'pending') throw new Error('expected the retried application to be pending')
    expect(retried.outcome.manuscript).toBe('revised')
  })

  it("states the application's own collapse: a seam that throws closes the action at its scope rather than leaving it open", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const broken: ModelAccess = {
      call: () => Promise.reject(new Error('the seam broke in a way nothing named')),
      status: () => Promise.resolve({ reachable: true, models: [] }),
    }
    const room = buildTestRoom(dataRoot, roomSpecWith(broken))

    const events: RoomEvent[] = []
    room.subscribe(pieceId, (event) => events.push(event))

    await expect(room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft text'))).rejects.toThrowError(
      'the seam broke in a way nothing named',
    )

    expect(events.map((event) => event.type)).toEqual(['action.started', 'action.finished'])
    expect(events.find((event) => event.type === 'action.finished')?.data).toMatchObject({ outcome: 'failed' })
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('confirmed against the document as saved, persists the change and the entry that names the response it came from, and frees the scope', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } } },
    })
    const source = responseId(pieceId)

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), 'c1', source, undefined, documents('The cups sat where she left them, twice.'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    await new DraftStore().write(workspaceDir, pieceId, outcome.manuscript)
    const confirmed = await room.confirmApply(workspaceDir, scope(pieceId), 'c1', outcome.applicationId)

    const [onDisk] = readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)
    expect(onDisk?.content).toEqual(confirmed.change)
    expect(confirmed.entryId).toBe(outcome.applicationId)

    const [application] = entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')
    expect(application).toMatchObject({ id: outcome.applicationId, responseId: source, changeId: onDisk?.id })
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('carries no change where the application returned the manuscript unchanged, and creates nothing pending or durable', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'unchanged text' } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('unchanged text'))

    expect(outcome).toMatchObject({ outcome: 'noChange' })
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()
  })

  it('refuses confirmation as not-pending for an unknown identity, and as document-not-saved while the target does not yet match — either refusal records nothing but frees the scope for a fresh application', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised text' } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft text'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')

    await expect(room.confirmApply(workspaceDir, scope(pieceId), 'c1', 'no-such-application')).rejects.toThrowError(ApplicationNotPendingError)

    // The pending application's own identity, but the draft was never saved to match it.
    await expect(room.confirmApply(workspaceDir, scope(pieceId), 'c1', outcome.applicationId)).rejects.toThrowError(
      ApplicationDocumentNotSavedError,
    )
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toEqual([])
    expect(readAppliedChanges(dataRoot, draftScope(workspaceDir, pieceId), appliedChangeSchema)).toEqual([])
    expect(room.activitySnapshot(scope(pieceId))).toBeUndefined()

    const retried = await room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft text'))
    expect(retried.outcome.outcome).toBe('pending')
  })

  it('confirming an already-committed identity a second time is a no-op that answers with what it already committed', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised text' } } },
    })

    const { outcome } = await room.apply(workspaceDir, scope(pieceId), 'c1', responseId(pieceId), undefined, documents('draft text'))
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    await new DraftStore().write(workspaceDir, pieceId, outcome.manuscript)

    const first = await room.confirmApply(workspaceDir, scope(pieceId), 'c1', outcome.applicationId)
    const second = await room.confirmApply(workspaceDir, scope(pieceId), 'c1', outcome.applicationId)

    expect(second).toEqual(first)
    expect(entries(dataRoot, workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')).toHaveLength(1)
  })

  it("on the story context surface, targets story context rather than the draft: the prompt carries it verbatim with its own reference schema and the preserve-instruction, and the confirmed change lands under story context's own conversation, never the draft's", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const storyContextScope: RoomScope = { pieceId: piece.id, surface: 'storyContext' }
    const storyContextConversationScope: ConversationScope = { kind: 'piece', workspaceDir, pieceId: piece.id, surface: 'storyContext' }

    const { room: settingUp } = buildRoom(dataRoot, {
      'story-editor': { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'name the second cup' } } },
    })
    await settingUp.dispatch(
      workspaceDir,
      storyContextScope,
      'c1',
      { kind: 'targeted', target: 'story-editor', text: 'what should the story context say' },
      documents('the draft, untouched', { storyContext: 'Premise: two cups.' }),
    )
    await settlementOfScope(settingUp, storyContextScope)

    const [response] = (readConversationEntries(dataRoot, storyContextConversationScope, 'c1')?.entries ?? []).filter(
      (entry) => entry.kind === 'participantResponse',
    )
    if (response === undefined) throw new Error('expected a landed response')

    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'Premise: two cups, one chipped.' } } },
    })

    const { outcome } = await room.apply(
      workspaceDir,
      storyContextScope,
      'c1',
      response.id,
      undefined,
      documents('the draft, untouched', { storyContext: 'Premise: two cups.' }),
    )
    if (outcome.outcome !== 'pending') throw new Error('expected the application to be pending')
    expect(outcome.manuscript).toBe('Premise: two cups, one chipped.')

    // The document verbatim, its own reference schema, the story-context framing, and the
    // generic preserve-instruction — never the draft as what is being rewritten.
    expect(adapter.promptFor('apply')).toContain('Premise: two cups.')
    expect(adapter.promptFor('apply')).toContain(fixtureMode.storyContextReference)
    expect(adapter.promptFor('apply')).toContain('FIXTURE_STORY_CONTEXT_SURFACE')
    expect(adapter.promptFor('apply')).toContain('FIXTURE_APPLY_TASK')

    await writeStoryContext(workspaceDir, piece.id, outcome.manuscript)
    const confirmed = await room.confirmApply(workspaceDir, storyContextScope, 'c1', outcome.applicationId)

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
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'shape', text: 'say more about that, @compression' }, documents('draft text'))
    await settlementOf(room, piece.id)

    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('shape')).toContain('say more about that, @compression')

    const landed = entries(dataRoot, workspaceDir, piece.id, 'c1')
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', audience: ['shape'], text: 'say more about that, @compression' })
  })

  /**
   * One claim over both acts: an act naming something the conversation does not hold is
   * refused before an action opens, rather than opened against nobody.
   */
  it('refuses an act naming a participant or a response that is not there, opening no action either way', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room } = buildRoom(dataRoot, {})

    await expect(
      room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'no-such-participant', text: 'a reply' }, documents('draft text')),
    ).rejects.toThrowError(ParticipantNotFoundError)
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()

    await expect(
      room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'ask', respondingTo: 'no-such-response', clarification: undefined }, documents('draft text')),
    ).rejects.toThrowError(CommentaryNotFoundError)
    expect(room.activitySnapshot(scope(piece.id))).toBeUndefined()
  })

  it("asking for a concrete change opens a dispatch with no message, calling only the response's own participant", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'The entry is late.', note: 'By a paragraph.' } } },
    })
    await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'targeted', target: 'shape', text: 'does the opening earn its length' }, documents('draft text'))
    await settlementOf(room, piece.id)
    const [firstResponse] = entries(dataRoot, workspaceDir, piece.id, 'c1').filter((entry) => entry.kind === 'participantResponse')
    if (firstResponse === undefined) throw new Error('expected a landed response')

    const { room: askRoom, adapter: askAdapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the aside' } } },
    })

    const events: RoomEvent[] = []
    askRoom.subscribe(piece.id, (event) => events.push(event))

    await askRoom.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'ask', respondingTo: firstResponse.id, clarification: 'what would you cut' }, documents('draft text'))
    await settlementOf(askRoom, piece.id)

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
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { actionId } = await room.dispatch(workspaceDir, scope(piece.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))

    const events: RoomEvent[] = []
    const { snapshot, unsubscribe } = room.connect(piece.id, (event) => events.push(event))

    expect(snapshot.draft).toMatchObject({ actionId, kind: 'dispatch' })
    expect(snapshot.storyContext).toBeNull()
    expect(snapshot.authorContext).toBeNull()
    // Nothing arrived on the listener between capturing the snapshot and registering it.
    expect(events).toEqual([])

    unsubscribe()
    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settlementOf(room, piece.id)
  })

  it("abandons a different piece's unfinished work across all three of its room scopes on opening this one, and resumes a piece's own work untouched on reconnecting to it", async () => {
    const first = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const second = await createPiece(workspaceDir, 'Kettle', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    room.connect(first.id, () => {})
    await room.dispatch(workspaceDir, scope(first.id), 'c1', { kind: 'message', text: 'a message' }, documents('draft text'))
    const authorContextScope: RoomScope = { pieceId: first.id, surface: 'authorContext' }
    await room.dispatch(workspaceDir, authorContextScope, 'c2', { kind: 'message', text: 'a durable note' }, documents('draft text'))
    const draftSettled = settlementOfScope(room, scope(first.id))
    const authorContextSettled = settlementOfScope(room, authorContextScope)

    // Opening a different piece is the transition: the first piece's work, on both the scopes
    // it was running, is abandoned — including the author-context scope, which still names the
    // first piece even though its conversation lives in the global namespace.
    room.connect(second.id, () => {})

    expect(room.activitySnapshot(scope(first.id))).toBeUndefined()
    expect(room.activitySnapshot(authorContextScope)).toBeUndefined()
    await draftSettled
    await authorContextSettled

    const secondScope = scope(second.id)
    const secondDispatch = await room.dispatch(workspaceDir, secondScope, 'c1', { kind: 'message', text: 'another message' }, documents('draft text'))
    // Reconnecting to the piece already open resumes it: its own in-flight work stands.
    room.connect(second.id, () => {})
    expect(room.activitySnapshot(secondScope)).toMatchObject({ actionId: secondDispatch.actionId })

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settlementOf(room, second.id)
  })
})
