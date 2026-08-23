import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ModelAccess } from '../../../src/server/model/modelAccess.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece } from '../../../src/server/pieces.js'
import { readConversation, readPiece, writePieceCast } from '../../../src/server/store/index.js'
import { conversationSchema } from '../../../src/shared/conversationViews.js'
import { Room, RoomBusyError } from '../../../src/server/room/room.js'
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

  it('creates the conversation file only once the first round has settled, not before', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } }, held: true },
    })

    const { conversationId, roundId } = await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    expect(readConversation(workspaceDir, piece.id, conversationId, conversationSchema)).toBeUndefined()

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await waitForIdle(room, piece.id)

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
    // The room announces the round's full roster at open — the cast's own
    // call order is the round's fact and is proven there, not here.
    expect(events[0]).toBe('opened:shape,compression,story-editor')

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await waitForIdle(room, piece.id)

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
    adapter.release('shape')
    await waitForIdle(room, piece.id)

    const updated = readPiece(workspaceDir, piece.id)
    expect(updated?.metadata.cast.sort()).toEqual(['compression', 'shape'])
  })

  it('persists an abandoned round to the conversation file rather than skipping the write', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room } = buildRoom({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
    })

    const { conversationId } = await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    room.abandon(piece.id)
    await waitForIdle(room, piece.id)

    // What an abandoned round keeps is the round's own fact, proven at
    // `round.test.ts`; this asserts only that the room writes the record at
    // all, on the same terms as a settled one.
    const conversation = readConversation(workspaceDir, piece.id, conversationId, conversationSchema)
    expect(conversation?.rounds[0]?.outcome).toBe('abandoned')
  })
})

/** Room settles asynchronously in the background; poll its own snapshot rather than the test reaching into private state. */
async function waitForIdle(room: Room, pieceId: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (room.snapshot(pieceId) === undefined) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('room never settled')
}
