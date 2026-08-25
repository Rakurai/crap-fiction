import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelAccess } from '../../../src/server/model/types.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece } from '../../../src/server/pieces.js'
import { readAppliedChanges, readConversationEntries, readPiece, TolerantReadError, writePieceCast } from '../../../src/server/store/index.js'
import { appliedChangeSchema } from '../../../src/shared/appliedChange.js'
import type { ConversationEntry } from '../../../src/shared/conversationEntries.js'
import {
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
import { CHARTER_FIXTURE, PROMPT_FRAGMENTS_FIXTURE } from '../../support/roomFixtures.js'

const fixtureMode: ModeDescriptor = {
  id: 'flash',
  displayName: 'Flash',
  description: 'A short piece read in one sitting.',
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
  }
}

function buildRoom(dataRoot: string, behaviors: Readonly<Record<string, FixtureBehavior>>): { room: Room; adapter: FixtureModelAdapter } {
  const adapter = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
  const room = buildTestRoom(dataRoot, roomSpecWith(adapter))
  return { room, adapter }
}

function entries(workspaceDir: string, pieceId: string, conversationId: string): readonly ConversationEntry[] {
  return readConversationEntries(workspaceDir, pieceId, conversationId)?.entries ?? []
}

function settlementOf(room: Room, pieceId: string): Promise<void> {
  const settlement = room.settlement(pieceId)
  if (settlement === undefined) throw new Error(`no dispatch in flight for "${pieceId}"`)
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
    await writePieceCast(workspaceDir, piece.id, ['shape', 'compression', 'interiority'])
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    await settlementOf(room, piece.id)

    const landed = entries(workspaceDir, piece.id, conversationId)
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', text: 'a message', audience: [] })
    expect(landed.filter((entry) => entry.kind === 'participantResponse')).toHaveLength(2)
    expect(adapter.promptFor('shape')).toContain('a message')
    expect(adapter.promptFor('interiority')).toBeUndefined()
  })

  it('states a failure synchronously, rather than opening an action, when the conversation on disk cannot be read', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    mkdirSync(path.join(workspaceDir, piece.id, 'conversations'), { recursive: true })
    writeFileSync(path.join(workspaceDir, piece.id, 'conversations', 'c1.json'), '{ not valid json', 'utf8')
    const { room } = buildRoom(dataRoot, {})

    await expect(room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')).rejects.toThrowError(
      TolerantReadError,
    )
    expect(room.activitySnapshot(piece.id)).toBeUndefined()
  })

  it('closes the action as failed, naming the failure, when the durable context cannot be read', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    writeFileSync(path.join(workspaceDir, piece.id, 'story-context.yaml'), 'Premise: 42\n', 'utf8')
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    await settlementOf(room, piece.id)

    expect(events.map((event) => event.type)).toEqual(['action.started', 'entry.appended', 'error', 'action.finished'])
    const failure = events.find((event) => event.type === 'error')
    expect(failure?.data).toMatchObject({ code: 'CONTEXT_UNREADABLE' })
    const finished = events.find((event) => event.type === 'action.finished')
    expect(finished?.data).toMatchObject({ outcome: 'failed' })

    expect(room.activitySnapshot(piece.id)).toBeUndefined()
    expect(readConversationEntries(workspaceDir, piece.id, 'c1')?.entries).toEqual([expect.objectContaining({ kind: 'authorMessage' })])
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

    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')

    await expect(settlementOf(room, piece.id)).resolves.toBeUndefined()

    expect(events.map((event) => event.type)).toEqual(['action.started', 'entry.appended', 'error', 'action.finished'])
    expect(events.find((event) => event.type === 'error')?.data).toMatchObject({
      code: 'UNEXPECTED_FAILURE',
      message: 'the seam broke in a way nothing named',
    })
    expect(events.find((event) => event.type === 'action.finished')?.data).toMatchObject({ outcome: 'failed' })

    expect(room.activitySnapshot(piece.id)).toBeUndefined()
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

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    const settled = settlementOf(room, piece.id)
    expect(events[0]).toBe('started:shape,compression,story-editor')
    expect(entries(workspaceDir, piece.id, conversationId)).toMatchObject([{ kind: 'authorMessage', text: 'a message' }])

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    expect(events[events.length - 1]).toBe('finished:settled')
    for (const participantId of ['shape', 'compression', 'story-editor']) {
      expect(events.indexOf(`state:${participantId}:working`)).toBeLessThan(events.indexOf(`settled:${participantId}`))
    }

    const landed = entries(workspaceDir, piece.id, conversationId)
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

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
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

    const landed = entries(workspaceDir, piece.id, conversationId).filter((entry) => entry.kind === 'participantResponse')
    expect(landed.map((entry) => entry.participantId)).toEqual(['compression', 'shape', 'story-editor'])
  })

  it('durably enables a specialist addressed from outside the enabled cast, naming it as brought — and brings nobody where addressing names only the cast', async () => {
    const brought = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    await writePieceCast(workspaceDir, brought.id, ['compression'])
    const alreadyIn = await createPiece(workspaceDir, 'Kettle', fixtureMode.id, [fixtureMode], fixtureSpecialists)

    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } } },
    })

    await room.dispatch(workspaceDir, brought.id, 'c1', { kind: 'message', text: '@shape a direct question' }, 'draft text')
    await settlementOf(room, brought.id)

    expect(readPiece(workspaceDir, brought.id)?.metadata.cast.sort()).toEqual(['compression', 'shape'])
    expect(entries(workspaceDir, brought.id, 'c1')[0]).toMatchObject({ kind: 'authorMessage', brought: ['shape'] })

    await room.dispatch(workspaceDir, alreadyIn.id, 'c1', { kind: 'message', text: '@shape a direct question' }, 'draft text')
    await settlementOf(room, alreadyIn.id)

    expect(entries(workspaceDir, alreadyIn.id, 'c1')[0]).toMatchObject({ kind: 'authorMessage', brought: [] })
    expect(adapter.promptFor('shape')).toBeDefined()
  })

  it('calls a named addressed-only participant alone, enrolling it in nothing and trailing it with no generalist call', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      toolsmith: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a tool reading' } } },
    })

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: '@toolsmith sharpen this' }, 'draft text')
    await settlementOf(room, piece.id)

    expect(adapter.promptFor('toolsmith')).toBeDefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
    expect(readPiece(workspaceDir, piece.id)?.metadata.cast.sort()).toEqual(['compression', 'shape'])

    const landed = entries(workspaceDir, piece.id, conversationId)
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

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    await settlementOf(room, piece.id)

    expect(events).not.toContain('error')
    expect(events[events.length - 1]).toBe('action.finished')

    const landed = entries(workspaceDir, piece.id, conversationId)
    expect(landed.filter((entry) => entry.kind === 'participantFailure')).toHaveLength(3)
  })

  it('persists no entry for the participant abandoned mid-call, and leaves it stopped at that point', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { conversationId, actionId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    const settled = settlementOf(room, piece.id)
    room.abandon(piece.id, actionId)
    expect(room.activitySnapshot(piece.id)).toBeUndefined()
    await settled

    const landed = entries(workspaceDir, piece.id, conversationId)
    expect(landed).toEqual([{ id: expect.any(String), kind: 'authorMessage', text: 'a message', audience: [], brought: [] }])
  })

  it('ABANDON-UNTRACK: lets a new dispatch start immediately without waiting for the abandoned one to unwind, and treats the stale actionId as a silent no-op that never touches it', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    const { actionId: firstActionId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'first' }, 'draft text')
    room.abandon(piece.id, firstActionId)

    const { conversationId, actionId: secondActionId } = await room.dispatch(
      workspaceDir,
      piece.id,
      'c1',
      { kind: 'message', text: 'second' },
      'draft text',
    )
    expect(secondActionId).not.toBe(firstActionId)
    const settled = settlementOf(room, piece.id)

    room.abandon(piece.id, firstActionId)
    expect(room.activitySnapshot(piece.id)).toMatchObject({ actionId: secondActionId })

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    const landed = entries(workspaceDir, piece.id, conversationId).filter(
      (entry) => entry.kind === 'participantResponse' || entry.kind === 'participantNoComment',
    )
    expect(landed).toHaveLength(3)
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
    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'targeted', target: 'shape', text: 'a direct question' }, 'draft text')
    await settlementOf(room, piece.id)
    adapter.release('shape')
    return { pieceId: piece.id }
  }

  function responseId(pieceId: string): string {
    const [response] = entries(workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'participantResponse')
    if (response === undefined) throw new Error('expected a landed response')
    return response.id
  }

  it('produces the manuscript the model returned, calling no participant', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } } },
    })

    const { result } = await room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'The cups sat where she left them, twice.')

    if (result.outcome !== 'value') throw new Error('expected the application to settle')
    expect(result.value.manuscript).toBe('The cups sat where she left them.')
    expect(adapter.promptFor('shape')).toBeUndefined()
    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()
  })

  it("carries the recommendation, the author's constraint and the draft verbatim, beside the full current conversation including discussion after the recommendation", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room: laterRoom } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } } },
    })
    await laterRoom.dispatch(workspaceDir, pieceId, 'c1', { kind: 'message', text: 'a later, unrelated question' }, 'draft text')
    await settlementOf(laterRoom, pieceId)

    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } } },
    })

    await room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), 'keep the last line', 'draft text')

    expect(adapter.promptFor('apply')).toContain('cut the second paragraph')
    expect(adapter.promptFor('apply')).toContain('keep the last line')
    expect(adapter.promptFor('apply')).toContain('draft text')
    expect(adapter.promptFor('apply')).toContain('a later, unrelated question')
  })

  it('refuses when no such applicable suggestion stands at that identity', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {})

    await expect(room.apply(workspaceDir, pieceId, 'c1', 'no-such-response', undefined, 'draft')).rejects.toThrowError(
      RecommendationNotFoundError,
    )
    expect(room.activitySnapshot(pieceId)).toBeUndefined()
  })

  /**
   * One conversation-action state, held across the studio rather than per piece, because no runtime
   * holds more than one dispatch-or-apply call at a time. One property, so it is stated once over
   * every pair that can contend for it rather than once per pair.
   */
  it('admits one dispatch or application at a time, whichever piece asks, and names the piece holding it', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const other = await createPiece(workspaceDir, 'Kettle', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    // Two dispatches issued in the same tick: only the first ever opens.
    const [first, second] = await Promise.allSettled([
      room.dispatch(workspaceDir, pieceId, 'c2', { kind: 'message', text: 'first' }, 'draft text'),
      room.dispatch(workspaceDir, pieceId, 'c2', { kind: 'message', text: 'second' }, 'draft text'),
    ])
    expect(first?.status).toBe('fulfilled')
    expect(second?.status === 'rejected' && second.reason).toBeInstanceOf(RoomBusyError)
    expect(entries(workspaceDir, pieceId, 'c2')).toMatchObject([{ kind: 'authorMessage', text: 'first' }])
    const settled = settlementOf(room, pieceId)

    // A second piece contends for the same runtime, and is told which piece holds it.
    await expect(room.dispatch(workspaceDir, other.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')).rejects.toThrowError(
      new RoomBusyError(pieceId),
    )
    expect(room.activitySnapshot(other.id)).toBeUndefined()

    // So does an application.
    await expect(room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft')).rejects.toThrowError(RoomBusyError)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    // And the other way round: an application in flight holds the lock against a dispatch.
    const { room: applyRoom, adapter: applyAdapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })
    const applying = applyRoom.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft')

    await expect(applyRoom.dispatch(workspaceDir, pieceId, 'c1', { kind: 'message', text: 'a message' }, 'draft text')).rejects.toThrowError(
      RoomBusyError,
    )

    applyAdapter.release('apply')
    await applying
  })

  it('leaves the recommendation applicable, and the draft as it was, where the application did not settle', async () => {
    const { pieceId } = await pieceWithRecommendation()

    // Abandoned mid-call.
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })
    const events: RoomEvent[] = []
    room.subscribe(pieceId, (event) => events.push(event))

    const applying = room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft text')
    const started = events.find((event) => event.type === 'action.started')
    if (started === undefined) throw new Error('expected action.started to have fired synchronously')
    room.abandon(pieceId, started.data.actionId)
    await expect(applying).resolves.toMatchObject({ result: { outcome: 'abandoned' } })
    expect(room.activitySnapshot(pieceId)).toBeUndefined()

    // Failed outright.
    const { room: failing } = buildRoom(dataRoot, { apply: { result: { outcome: 'failed', reason: 'unconfigured' } } })
    const { result } = await failing.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft text')
    expect(result).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(failing.activitySnapshot(pieceId)).toBeUndefined()
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()

    // The recommendation still stands at its identity, so a later application settles.
    adapter.release('apply')
    const retried = await room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft text')
    if (retried.result.outcome !== 'value') throw new Error('expected the retried application to settle')
    expect(retried.result.value.manuscript).toBe('revised')
  })

  it('persists the change a settled call actually made, naming the response it came from', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } } },
    })
    const source = responseId(pieceId)

    const { result } = await room.apply(workspaceDir, pieceId, 'c1', source, undefined, 'The cups sat where she left them, twice.')

    if (result.outcome !== 'value') throw new Error('expected the application to settle')
    const [onDisk] = readAppliedChanges(workspaceDir, pieceId, appliedChangeSchema)
    expect(onDisk).toEqual(result.value.change)

    const [application] = entries(workspaceDir, pieceId, 'c1').filter((entry) => entry.kind === 'application')
    expect(application).toMatchObject({ responseId: source, changeId: result.value.change?.id })
  })

  it('carries no change where the application returned the manuscript unchanged', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'unchanged text' } } },
    })

    const { result } = await room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'unchanged text')

    if (result.outcome !== 'value') throw new Error('expected the application to settle')
    expect(result.value.change).toBeUndefined()
    expect(readAppliedChanges(workspaceDir, pieceId, appliedChangeSchema)).toEqual([])
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

    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'targeted', target: 'shape', text: 'say more about that, @compression' }, 'draft text')
    await settlementOf(room, piece.id)

    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('shape')).toContain('say more about that, @compression')

    const landed = entries(workspaceDir, piece.id, 'c1')
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
      room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'targeted', target: 'no-such-participant', text: 'a reply' }, 'draft text'),
    ).rejects.toThrowError(ParticipantNotFoundError)
    expect(room.activitySnapshot(piece.id)).toBeUndefined()

    await expect(
      room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'ask', respondingTo: 'no-such-response', clarification: undefined }, 'draft text'),
    ).rejects.toThrowError(CommentaryNotFoundError)
    expect(room.activitySnapshot(piece.id)).toBeUndefined()
  })

  it("asking for a concrete change opens a dispatch with no message, calling only the response's own participant", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode.id, [fixtureMode], fixtureSpecialists)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'The entry is late.', note: 'By a paragraph.' } } },
    })
    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'targeted', target: 'shape', text: 'does the opening earn its length' }, 'draft text')
    await settlementOf(room, piece.id)
    const [firstResponse] = entries(workspaceDir, piece.id, 'c1').filter((entry) => entry.kind === 'participantResponse')
    if (firstResponse === undefined) throw new Error('expected a landed response')

    const { room: askRoom, adapter: askAdapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the aside' } } },
    })

    const events: RoomEvent[] = []
    askRoom.subscribe(piece.id, (event) => events.push(event))

    await askRoom.dispatch(workspaceDir, piece.id, 'c1', { kind: 'ask', respondingTo: firstResponse.id, clarification: 'what would you cut' }, 'draft text')
    await settlementOf(askRoom, piece.id)

    const started = events.find((event) => event.type === 'action.started')
    expect(started?.type === 'action.started' && started.data.kind === 'dispatch' && started.data.audience).toEqual(['shape'])

    expect(askAdapter.promptFor('shape')).toContain('The entry is late.')
    expect(askAdapter.promptFor('shape')).toContain('what would you cut')
    expect(askAdapter.promptFor('compression')).toBeUndefined()
    expect(askAdapter.promptFor('story-editor')).toBeUndefined()

    const landed = entries(workspaceDir, piece.id, 'c1')
    const request = landed.find((entry) => entry.kind === 'concreteChangeRequest')
    expect(request).toMatchObject({ target: 'shape', respondingTo: firstResponse.id, clarification: 'what would you cut' })
  })
})
