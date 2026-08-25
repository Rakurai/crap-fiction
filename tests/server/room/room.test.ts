import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModelAccess } from '../../../src/server/model/types.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece, PieceNotFoundError } from '../../../src/server/pieces.js'
import {
  readAppliedChanges,
  readAuthorContext,
  readConversationEntries,
  readPiece,
  readStoryContext,
  TolerantReadError,
  writePieceCast,
  writeStoryContext,
} from '../../../src/server/store/index.js'
import { appliedChangeSchema } from '../../../src/shared/appliedChange.js'
import type { ConversationEntry } from '../../../src/shared/conversationEntries.js'
import { durableContextSchema } from '../../../src/shared/durableContext.js'
import {
  CommentaryNotFoundError,
  ParticipantNotFoundError,
  RecommendationNotFoundError,
  Room,
  RoomBusyError,
  type RoomEvent,
} from '../../../src/server/room/room.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../../support/modelAdapter.js'
import { buildTestRoom } from '../../support/room.js'

const fixtureMode: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [
    { id: 'shape', attendsTo: 'x', defect: 'y' },
    { id: 'compression', attendsTo: 'x', defect: 'y' },
  ],
}

const fixtureRoles = [
  { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'x' },
  { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'y' },
  { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'z' },
]

function buildRoom(dataRoot: string, behaviors: Readonly<Record<string, FixtureBehavior>>): { room: Room; adapter: FixtureModelAdapter } {
  const adapter = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
  const modelAccess = adapter
  const room = buildTestRoom(dataRoot, { mode: fixtureMode, roles: fixtureRoles, modelAccess })
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

  it('refuses a second dispatch while one is in flight for the same piece', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')

    await expect(room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'another message' }, 'draft text')).rejects.toThrowError(
      RoomBusyError,
    )

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('SPEC "Model access": refuses a dispatch for a second piece while one is in flight, since no runtime holds more than one call', async () => {
    const cups = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const other = await createPiece(workspaceDir, 'Kettle', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    await room.dispatch(workspaceDir, cups.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')

    await expect(room.dispatch(workspaceDir, other.id, 'c2', { kind: 'message', text: 'a message' }, 'draft text')).rejects.toThrowError(
      new RoomBusyError(cups.id),
    )
    expect(room.activitySnapshot(other.id)).toBeUndefined()

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('CONTEXT "Round": an unaddressed dispatch reads nothing for addressing and calls the enabled cast', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
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
  })

  it('states a failure synchronously, rather than opening an action, when the conversation on disk cannot be read', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    mkdirSync(path.join(workspaceDir, piece.id, 'conversations'), { recursive: true })
    writeFileSync(path.join(workspaceDir, piece.id, 'conversations', 'c1.json'), '{ not valid json', 'utf8')
    const { room } = buildRoom(dataRoot, {})

    await expect(room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')).rejects.toThrowError(
      TolerantReadError,
    )
    expect(room.activitySnapshot(piece.id)).toBeUndefined()
  })

  it('closes the action as failed, naming the failure, when the durable context cannot be read', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
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
    // The author's own entry is durable regardless of what the dispatch that follows does with it.
    expect(readConversationEntries(workspaceDir, piece.id, 'c1')?.entries).toEqual([expect.objectContaining({ kind: 'authorMessage' })])
  })

  it("owns the dispatch's own collapse: a seam that throws instead of failing closes the action and is stated, not rethrown into nothing", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const broken: ModelAccess = {
      call: () => Promise.reject(new Error('the seam broke in a way nothing named')),
      status: () => Promise.resolve({ reachable: true, models: [] }),
    }
    const room = buildTestRoom(dataRoot, { mode: fixtureMode, roles: fixtureRoles, modelAccess: broken })

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

  it('writes the author entry immediately, with its resolved audience, before any participant is called', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } }, held: true },
    })

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    const settled = settlementOf(room, piece.id)
    expect(entries(workspaceDir, piece.id, conversationId)).toMatchObject([{ kind: 'authorMessage', text: 'a message' }])

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    const landed = entries(workspaceDir, piece.id, conversationId)
    expect(landed).toHaveLength(4)
    expect(landed.filter((entry) => entry.kind === 'participantNoComment')).toHaveLength(2)
    expect(landed.filter((entry) => entry.kind === 'participantResponse')).toHaveLength(1)
  })

  it('calls the enabled cast, then the Story Editor, appending each response as it lands', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } }, held: true, states: ['working'] },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true, states: ['working'] },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true, states: ['working'] },
    })

    const events: string[] = []
    room.subscribe(piece.id, (event) => {
      if (event.type === 'action.started') events.push(`started:${event.data.audience?.join(',')}`)
      if (event.type === 'participant.activity') events.push(`state:${event.data.participantId}:${event.data.state}`)
      if (event.type === 'entry.appended' && event.data.entry.kind === 'participantResponse') events.push(`settled:${event.data.entry.participantId}`)
      if (event.type === 'entry.appended' && event.data.entry.kind === 'participantNoComment') events.push(`settled:${event.data.entry.participantId}`)
      if (event.type === 'action.finished') events.push(`finished:${event.data.outcome}`)
    })

    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    const settled = settlementOf(room, piece.id)
    expect(events[0]).toBe('started:shape,compression,story-editor')

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    expect(events[events.length - 1]).toBe('finished:settled')
    for (const participantId of ['shape', 'compression', 'story-editor']) {
      expect(events.indexOf(`state:${participantId}:working`)).toBeLessThan(events.indexOf(`settled:${participantId}`))
    }
  })

  it('durably enables a specialist that was addressed but not part of the enabled cast', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writePieceCast(workspaceDir, piece.id, ['compression'])

    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } }, held: true },
    })

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: '@shape a direct question' }, 'draft text')
    const settled = settlementOf(room, piece.id)
    adapter.release('shape')
    await settled

    const updated = readPiece(workspaceDir, piece.id)
    expect(updated?.metadata.cast.sort()).toEqual(['compression', 'shape'])

    const landed = entries(workspaceDir, piece.id, conversationId)
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', brought: ['shape'] })
  })

  it('leaves `brought` empty when addressing names only specialists already in the cast', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } }, held: true },
    })

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: '@shape a direct question' }, 'draft text')
    const settled = settlementOf(room, piece.id)
    adapter.release('shape')
    await settled

    const landed = entries(workspaceDir, piece.id, conversationId)
    expect(landed[0]).toMatchObject({ kind: 'authorMessage', brought: [] })
  })

  it('UX_DESIGN "Every specialist call failed... that call fails too": settles with nothing in it at all, without ever emitting an error event', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
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
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { conversationId } = await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    const settled = settlementOf(room, piece.id)
    room.abandon(piece.id)
    await settled

    const landed = entries(workspaceDir, piece.id, conversationId)
    expect(landed).toEqual([{ id: expect.any(String), kind: 'authorMessage', text: 'a message', audience: [], brought: [] }])
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
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
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

  it("carries the recommendation and the author's constraint, verbatim, into the call", async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } } },
    })

    await room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), 'keep the last line', 'draft text')

    expect(adapter.promptFor('apply')).toContain('cut the second paragraph')
    expect(adapter.promptFor('apply')).toContain('keep the last line')
    expect(adapter.promptFor('apply')).toContain('draft text')
  })

  it('refuses when no such applicable suggestion stands at that identity', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {})

    await expect(room.apply(workspaceDir, pieceId, 'c1', 'no-such-response', undefined, 'draft')).rejects.toThrowError(
      RecommendationNotFoundError,
    )
    expect(room.activitySnapshot(pieceId)).toBeUndefined()
  })

  it('refuses to apply while a dispatch is in flight for the same piece', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    await room.dispatch(workspaceDir, pieceId, 'c2', { kind: 'message', text: 'a message' }, 'draft text')

    await expect(room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft')).rejects.toThrowError(RoomBusyError)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('refuses to dispatch while an application is in flight', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })

    const applying = room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft')

    await expect(room.dispatch(workspaceDir, pieceId, 'c1', { kind: 'message', text: 'a message' }, 'draft text')).rejects.toThrowError(
      RoomBusyError,
    )

    adapter.release('apply')
    await applying
  })

  it('resolves as abandoned, and leaves the recommendation applicable, when abandoned mid-call', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })

    const applying = room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft text')
    room.abandon(pieceId)
    await expect(applying).resolves.toMatchObject({ result: { outcome: 'abandoned' } })

    expect(room.activitySnapshot(pieceId)).toBeUndefined()
    adapter.release('apply')
    const second = await room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft text')
    if (second.result.outcome !== 'value') throw new Error('expected the second application to settle')
    expect(second.result.value.manuscript).toBe('revised')
  })

  it('changes nothing on a failed call, and leaves the recommendation applicable', async () => {
    const { pieceId } = await pieceWithRecommendation()
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'failed', reason: 'unconfigured' } },
    })

    const { result } = await room.apply(workspaceDir, pieceId, 'c1', responseId(pieceId), undefined, 'draft text')
    expect(result).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(room.activitySnapshot(pieceId)).toBeUndefined()
    expect(readPiece(workspaceDir, pieceId)?.draft).toBeUndefined()
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

describe('Room.capture', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-room-capture-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it("gives each of the model's proposals an identity, calling no participant", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      capture: {
        result: {
          outcome: 'value',
          value: { proposals: [{ destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' }] },
        },
      },
    })

    const result = await room.capture(workspaceDir, piece.id, 'c1', 'The cups sat where she left them.')

    if (result.outcome !== 'value') throw new Error('expected the capture to settle')
    expect(result.value.proposals).toEqual([
      { id: expect.any(String), destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' },
    ])
    expect(adapter.promptFor('shape')).toBeUndefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
  })

  it('carries the draft and the conversation into the call, and reads an absent conversation as no history', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room: dispatchRoom, adapter: dispatchAdapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })
    await dispatchRoom.dispatch(workspaceDir, piece.id, 'c1', { kind: 'targeted', target: 'shape', text: 'a direct question' }, 'draft text')
    await settlementOf(dispatchRoom, piece.id)
    dispatchAdapter.release('shape')

    const { room, adapter } = buildRoom(dataRoot, {
      capture: { result: { outcome: 'value', value: { proposals: [] } } },
    })

    await room.capture(workspaceDir, piece.id, 'c1', 'The cups sat where she left them.')
    expect(adapter.promptFor('capture')).toContain('The cups sat where she left them.')
    expect(adapter.promptFor('capture')).toContain('cut the second paragraph')

    await room.capture(workspaceDir, piece.id, 'c2', 'text')
  })

  it('CONTEXT "Capture context": proceeds while a dispatch is in flight for the same piece, sharing the model seam but not the room\'s dispatch-and-apply lock', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
      capture: { result: { outcome: 'value', value: { proposals: [] } } },
    })

    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')

    const result = await room.capture(workspaceDir, piece.id, 'c1', 'draft text')
    expect(result).toEqual({ outcome: 'value', value: { proposals: [] } })

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('does not block a dispatch from opening for the same piece while it runs', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      capture: { result: { outcome: 'value', value: { proposals: [] } }, held: true },
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    const capturing = room.capture(workspaceDir, piece.id, 'c1', 'draft text')

    await room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'message', text: 'a message' }, 'draft text')
    await settlementOf(room, piece.id)

    adapter.release('capture')
    await capturing
  })

  it("SPEC \"Seams\": is unaffected by abandon(), which targets the dispatch-and-apply operation and never reaches capture", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      capture: { result: { outcome: 'value', value: { proposals: [] } }, held: true },
    })

    const capturing = room.capture(workspaceDir, piece.id, 'c1', 'draft text')
    room.abandon(piece.id)

    expect(room.captureSnapshot(piece.id)).toBeDefined()

    adapter.release('capture')
    await expect(capturing).resolves.toEqual({ outcome: 'value', value: { proposals: [] } })
  })

  it('refuses a second capture for the same piece while one is already in flight', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      capture: { result: { outcome: 'value', value: { proposals: [] } }, held: true },
    })

    const capturing = room.capture(workspaceDir, piece.id, 'c1', 'draft text')

    await expect(room.capture(workspaceDir, piece.id, 'c1', 'draft text')).rejects.toThrowError(RoomBusyError)

    adapter.release('capture')
    await capturing
  })

  it('reports its own activity on captureSnapshot, independently of the dispatch snapshot', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      capture: { result: { outcome: 'value', value: { proposals: [] } }, held: true },
    })

    expect(room.captureSnapshot(piece.id)).toBeUndefined()

    const capturing = room.capture(workspaceDir, piece.id, 'c1', 'draft text')

    expect(room.captureSnapshot(piece.id)).toMatchObject({ conversationId: 'c1' })
    expect(room.activitySnapshot(piece.id)).toBeUndefined()

    adapter.release('capture')
    await capturing

    expect(room.captureSnapshot(piece.id)).toBeUndefined()
  })

  it('reports a failed call as failed, proposing nothing', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom(dataRoot, {
      capture: { result: { outcome: 'failed', reason: 'unconfigured' } },
    })

    const result = await room.capture(workspaceDir, piece.id, 'c1', 'draft text')
    expect(result).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(room.activitySnapshot(piece.id)).toBeUndefined()
  })
})

describe('Room.approveCapture', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-room-approve-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir)
  })

  afterEach(() => {
    chmodSync(workspaceDir, 0o700)
    rmSync(dataRoot, { recursive: true, force: true })
  })

  it('writes an approved proposal to the destination it names, and nothing to the other', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom(dataRoot, {})

    const outcome = await room.approveCapture(workspaceDir, piece.id, [
      { id: 'p1', destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' },
    ])

    expect(outcome).toEqual({ written: ['storyContext'], failures: [] })
    expect(readStoryContext(workspaceDir, piece.id, durableContextSchema)).toEqual({ Premise: ['two cups, one left behind'] })
    expect(readAuthorContext(dataRoot, durableContextSchema)).toBeUndefined()
  })

  it('writes both destinations in one call when proposals approve both', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom(dataRoot, {})

    const outcome = await room.approveCapture(workspaceDir, piece.id, [
      { id: 'p1', destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups, one left behind' },
      { id: 'p2', destination: 'authorContext', section: 'Voice', operation: 'add', text: 'wry and close' },
    ])

    expect(outcome.written.sort()).toEqual(['authorContext', 'storyContext'])
    expect(readStoryContext(workspaceDir, piece.id, durableContextSchema)).toEqual({ Premise: ['two cups, one left behind'] })
    expect(readAuthorContext(dataRoot, durableContextSchema)).toEqual({ Voice: ['wry and close'] })
  })

  it('reads the context fresh rather than from anything the capture call saw, so a hand edit in between is not overwritten', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeStoryContext(workspaceDir, piece.id, { Premise: ['an old premise'] })
    const { room } = buildRoom(dataRoot, {})

    await room.approveCapture(workspaceDir, piece.id, [
      { id: 'p1', destination: 'storyContext', section: 'Voice', operation: 'add', text: 'wry and close' },
    ])

    expect(readStoryContext(workspaceDir, piece.id, durableContextSchema)).toEqual({
      Premise: ['an old premise'],
      Voice: ['wry and close'],
    })
  })

  it('SPEC "Context capture": keeps the destination that succeeded when the other write fails, naming which one', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom(dataRoot, {})
    chmodSync(path.join(workspaceDir, piece.id), 0o500)

    const outcome = await room.approveCapture(workspaceDir, piece.id, [
      { id: 'p1', destination: 'authorContext', section: 'Voice', operation: 'add', text: 'wry and close' },
      { id: 'p2', destination: 'storyContext', section: 'Premise', operation: 'add', text: 'two cups' },
    ])

    expect(outcome.written).toEqual(['authorContext'])
    expect(outcome.failures).toHaveLength(1)
    expect(outcome.failures[0]?.destination).toBe('storyContext')
    expect(readAuthorContext(dataRoot, durableContextSchema)).toEqual({ Voice: ['wry and close'] })

    // `rmSync` at cleanup cannot unlink inside a directory it has no write permission on.
    chmodSync(path.join(workspaceDir, piece.id), 0o700)
  })

  it('refuses for a piece that does not exist', async () => {
    const { room } = buildRoom(dataRoot, {})

    await expect(room.approveCapture(workspaceDir, 'no-such-piece', [])).rejects.toThrowError(PieceNotFoundError)
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
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
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

  it('replying to an unknown participant is refused, not opened against nobody', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom(dataRoot, {})

    await expect(
      room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'targeted', target: 'no-such-participant', text: 'a reply' }, 'draft text'),
    ).rejects.toThrowError(ParticipantNotFoundError)
    expect(room.activitySnapshot(piece.id)).toBeUndefined()
  })

  it("asking for a concrete change opens a dispatch with no message, calling only the response's own participant", async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
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
    expect(started?.type === 'action.started' && started.data.audience).toEqual(['shape'])

    expect(askAdapter.promptFor('shape')).toContain('The entry is late.')
    expect(askAdapter.promptFor('shape')).toContain('what would you cut')
    expect(askAdapter.promptFor('shape')).not.toContain("Author's message")
    expect(askAdapter.promptFor('compression')).toBeUndefined()
    expect(askAdapter.promptFor('story-editor')).toBeUndefined()

    const landed = entries(workspaceDir, piece.id, 'c1')
    const request = landed.find((entry) => entry.kind === 'concreteChangeRequest')
    expect(request).toMatchObject({ target: 'shape', respondingTo: firstResponse.id, clarification: 'what would you cut' })
  })

  it('refuses where no commentary stands at the named response', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom(dataRoot, {})

    await expect(
      room.dispatch(workspaceDir, piece.id, 'c1', { kind: 'ask', respondingTo: 'no-such-response', clarification: undefined }, 'draft text'),
    ).rejects.toThrowError(CommentaryNotFoundError)
    expect(room.activitySnapshot(piece.id)).toBeUndefined()
  })
})
