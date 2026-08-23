import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ModelAccess } from '../../../src/server/model/modelAccess.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece } from '../../../src/server/pieces.js'
import { readConversation, readPiece, writePieceCast } from '../../../src/server/store/index.js'
import { conversationSchema } from '../../../src/shared/conversationViews.js'
import { Room, RoomBusyError, type RoomEvent } from '../../../src/server/room/room.js'
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

/**
 * Every site held open until the test releases it — the shape a busy-refusal
 * test needs, which an adapter that resolves on its own cannot give.
 * `release` may be called before the round ever reaches that site — calls
 * are sequential, so a test releasing every site upfront must not lose the
 * release racing against `invoke` registering its gate.
 */
function buildRoom(behaviors: Readonly<Record<string, FixtureBehavior>>): { room: Room; adapter: FixtureModelAdapter } {
  const adapter = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
  const modelAccess = new ModelAccess(adapter, (site) => site)
  const room = buildTestRoom({ mode: fixtureMode, roles: fixtureRoles, modelAccess })
  return { room, adapter }
}

describe('Room', () => {
  let workspaceDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(path.join(tmpdir(), 'studio-room-'))
  })

  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('refuses a second round while one is in flight for the same piece', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')

    await expect(room.startRound(workspaceDir, piece.id, 'c1', 'another message', 'draft text')).rejects.toThrowError(RoomBusyError)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('SPEC "Model access": refuses a round for a second piece while one is in flight, since no runtime holds more than one call', async () => {
    const cups = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const other = await createPiece(workspaceDir, 'Kettle', fixtureMode)
    const { room, adapter } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    await room.startRound(workspaceDir, cups.id, 'c1', 'a message', 'draft text')

    // The refusal names the piece holding the round rather than the one asked
    // for, because that is the one the author has to finish or abandon.
    await expect(room.startRound(workspaceDir, other.id, 'c2', 'a message', 'draft text')).rejects.toThrowError(
      new RoomBusyError(cups.id),
    )
    expect(room.snapshot(other.id)).toBeUndefined()

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('CONTEXT "Round": opens a round with no author message, reading nothing for addressing and calling the enabled cast', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    const { conversationId } = await room.startRound(workspaceDir, piece.id, 'c1', undefined, 'draft text')
    await settlementOf(room, piece.id)

    const conversation = readConversation(workspaceDir, piece.id, conversationId, conversationSchema)
    expect(conversation?.rounds[0]?.message).toBeUndefined()
    expect(conversation?.rounds[0]?.addressed).toEqual([])
    expect(conversation?.rounds[0]?.participants).toHaveLength(3)
    // No message means no "Author's message" section reached any participant —
    // nothing composes words the author did not write.
    expect(adapter.promptFor('shape')).not.toContain("Author's message")
  })

  it('closes the round as failed, naming the failure, when the conversation on disk cannot be read', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    // The one artifact the round reads before it does anything, hand-broken:
    // a conversation file the store will refuse rather than parse.
    mkdirSync(path.join(workspaceDir, piece.id, 'conversations'), { recursive: true })
    writeFileSync(path.join(workspaceDir, piece.id, 'conversations', 'c1.json'), '{ "id": 7 }', 'utf8')

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    // No settlement to wait on: the record is the first thing the round reads,
    // so this round opens and closes before the call that started it returns.
    await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')

    // The author is told what happened in the product's own vocabulary, and the
    // round stops being in flight — a failure that closed nothing would leave it
    // drawn as running for the rest of the session.
    expect(events.map((event) => event.type)).toEqual(['round.opened', 'error', 'round.closed'])
    const failure = events.find((event) => event.type === 'error')
    expect(failure?.data).toMatchObject({ code: 'CONVERSATION_UNREADABLE' })
    const closed = events.find((event) => event.type === 'round.closed')
    expect(closed?.data).toMatchObject({ outcome: 'failed' })

    // Nothing was called and nothing was written: the round never ran against a
    // record the studio would then have overwritten.
    expect(room.snapshot(piece.id)).toBeUndefined()
  })

  it('creates the conversation file only once the first round has settled, not before', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } }, held: true },
    })

    const { conversationId, roundId } = await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    const settled = settlementOf(room, piece.id)
    expect(readConversation(workspaceDir, piece.id, conversationId, conversationSchema)).toBeUndefined()

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    const conversation = readConversation(workspaceDir, piece.id, conversationId, conversationSchema)
    expect(conversation?.id).toBe('c1')
    expect(conversation?.rounds).toHaveLength(1)
    expect(conversation?.rounds[0]?.id).toBe(roundId)
    expect(conversation?.rounds[0]?.outcome).toBe('settled')
  })

  it('calls the enabled cast, then the Story Editor, on a round that names no one', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } }, held: true, states: ['working'] },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true, states: ['working'] },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true, states: ['working'] },
    })

    const events: string[] = []
    room.subscribe(piece.id, (event) => {
      if (event.type === 'round.opened') events.push(`opened:${event.data.participants.join(',')}`)
      if (event.type === 'participant.state') events.push(`state:${event.data.participantId}:${event.data.state}`)
      if (event.type === 'participant.settled') events.push(`settled:${event.data.participantId}`)
      if (event.type === 'round.closed') events.push(`closed:${event.data.outcome}`)
    })

    await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    const settled = settlementOf(room, piece.id)
    // The room announces the round's full roster at open — the cast's own
    // call order is the round's fact and is proven there, not here.
    expect(events[0]).toBe('opened:shape,compression,story-editor')

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await settled

    expect(events[events.length - 1]).toBe('closed:settled')
    for (const participantId of ['shape', 'compression', 'story-editor']) {
      expect(events.indexOf(`state:${participantId}:working`)).toBeLessThan(events.indexOf(`settled:${participantId}`))
    }
  })

  it('durably enables a specialist that was addressed but not part of the enabled cast', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writePieceCast(workspaceDir, piece.id, ['compression'])

    const { room, adapter } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } }, held: true },
    })

    await room.startRound(workspaceDir, piece.id, 'c1', '@shape a direct question', 'draft text')
    const settled = settlementOf(room, piece.id)
    adapter.release('shape')
    await settled

    const updated = readPiece(workspaceDir, piece.id)
    expect(updated?.metadata.cast.sort()).toEqual(['compression', 'shape'])
  })

  it('UX_DESIGN "Every specialist call failed... that call fails too": settles and persists a round with nothing in it at all, without ever emitting an error event', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom({
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'unreachable' } },
      'story-editor': { result: { outcome: 'failed', reason: 'nonconforming', returned: 'not json' } },
    })

    const events: string[] = []
    room.subscribe(piece.id, (event) => {
      events.push(event.type)
    })

    const { conversationId } = await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    await settlementOf(room, piece.id)

    // Nothing landed anywhere in the round, and that reads as information at
    // the boundary the author actually sees: a settled round, never the
    // room's own `error` event.
    expect(events).not.toContain('error')
    expect(events[events.length - 1]).toBe('round.closed')

    // What each participant's record holds is the round's own fact, proven at
    // `round.test.ts`; this asserts the room writes such a round rather than
    // treating an empty one as nothing worth persisting.
    const conversation = readConversation(workspaceDir, piece.id, conversationId, conversationSchema)
    expect(conversation?.rounds[0]?.outcome).toBe('settled')
    expect(conversation?.rounds[0]?.participants).toHaveLength(3)
  })

  it('persists an abandoned round to the conversation file rather than skipping the write', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { conversationId } = await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    const settled = settlementOf(room, piece.id)
    room.abandon(piece.id)
    await settled

    // What an abandoned round keeps is the round's own fact, proven at
    // `round.test.ts`; this asserts only that the room writes the record at
    // all, on the same terms as a settled one.
    const conversation = readConversation(workspaceDir, piece.id, conversationId, conversationSchema)
    expect(conversation?.rounds[0]?.outcome).toBe('abandoned')
  })
})

/**
 * A round settles after the call that started it has already returned, so a test
 * that asserts on what the round left behind waits on the room's own settlement
 * rather than polling for the round's absence. An absent one means the round was
 * never in flight, which is the test's own failure to start it.
 */
function settlementOf(room: Room, pieceId: string): Promise<void> {
  const settlement = room.settlement(pieceId)
  if (settlement === undefined) throw new Error(`no round in flight for "${pieceId}"`)
  return settlement
}
