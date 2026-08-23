import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModelAccess } from '../../../src/server/model/types.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece } from '../../../src/server/pieces.js'
import { readConversation, readPiece, writeConversation, writePieceCast } from '../../../src/server/store/index.js'
import { conversationSchema, type Conversation } from '../../../src/shared/conversationViews.js'
import { RecommendationNotFoundError, Room, RoomBusyError, type RoomEvent } from '../../../src/server/room/room.js'
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
function buildRoom(dataRoot: string, behaviors: Readonly<Record<string, FixtureBehavior>>): { room: Room; adapter: FixtureModelAdapter } {
  const adapter = FixtureModelAdapter.bySite(behaviors, { reachable: true, models: [] })
  const modelAccess = adapter
  const room = buildTestRoom(dataRoot, { mode: fixtureMode, roles: fixtureRoles, modelAccess })
  return { room, adapter }
}

describe('Room', () => {
  // The workspace sits inside the data root, as SPEC "Files" draws it: the
  // author's durable context is beside the workspace rather than in it, so a
  // room reading one needs the two nested the way the product has them.
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

  it('refuses a second round while one is in flight for the same piece', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
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
    const { room, adapter } = buildRoom(dataRoot, {
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
    const { room, adapter } = buildRoom(dataRoot, {
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
    const { room } = buildRoom(dataRoot, {
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

    await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    // The record is the first thing the round reads, so this round may already be
    // over before the call that started it returns; awaiting whatever settlement
    // is still there covers both orders rather than depending on one.
    await room.settlement(piece.id)

    // The author is told what happened in the product's own vocabulary, and the
    // round stops being in flight — a failure that closed nothing would leave it
    // drawn as running for the rest of the session.
    expect(events.map((event) => event.type)).toEqual(['round.opened', 'error', 'round.closed'])
    const failure = events.find((event) => event.type === 'error')
    expect(failure?.data).toMatchObject({ code: 'CONVERSATION_UNREADABLE' })
    const closed = events.find((event) => event.type === 'round.closed')
    expect(closed?.data).toMatchObject({ outcome: 'failed' })

    // Nothing was called and nothing was written: the round never ran against a
    // record the studio would then have overwritten, and the room is free again.
    expect(room.snapshot(piece.id)).toBeUndefined()
  })

  it('owns the round\'s own collapse: a seam that throws instead of failing closes the round and is stated, not rethrown into nothing', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    // A model seam that throws rather than returning one of the four stated
    // failure reasons — the one thing `RoundResult` has no room for. Nothing
    // above the room can act on it: the request that opened the round was
    // answered before this happened, so if the room does not own it, nobody does.
    const broken: ModelAccess = {
      call: () => Promise.reject(new Error('the seam broke in a way nothing named')),
      status: () => Promise.resolve({ reachable: true, models: [] }),
    }
    const room = buildTestRoom(dataRoot, { mode: fixtureMode, roles: fixtureRoles, modelAccess: broken })

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')

    // The settlement resolves. That is the whole of "the promise has an owner":
    // a rejection here would be the unhandled rejection that takes the process
    // down and every open subscription with it.
    await expect(settlementOf(room, piece.id)).resolves.toBeUndefined()

    expect(events.map((event) => event.type)).toEqual(['round.opened', 'error', 'round.closed'])
    expect(events.find((event) => event.type === 'error')?.data).toMatchObject({
      code: 'UNEXPECTED_FAILURE',
      message: 'the seam broke in a way nothing named',
    })
    expect(events.find((event) => event.type === 'round.closed')?.data).toMatchObject({ outcome: 'failed' })

    // The room is free and nothing was written: a round that collapsed is not a
    // round the author has to abandon before writing again.
    expect(room.snapshot(piece.id)).toBeUndefined()
    expect(readConversation(workspaceDir, piece.id, 'c1', conversationSchema)).toBeUndefined()
  })

  it('creates the conversation file only once the first round has settled, not before', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
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
    const { room, adapter } = buildRoom(dataRoot, {
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

    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } }, held: true },
    })

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    await room.startRound(workspaceDir, piece.id, 'c1', '@shape a direct question', 'draft text')
    const settled = settlementOf(room, piece.id)
    adapter.release('shape')
    await settled

    const updated = readPiece(workspaceDir, piece.id)
    expect(updated?.metadata.cast.sort()).toEqual(['compression', 'shape'])

    // UX_DESIGN "Where the author speaks": the room says it now holds one more,
    // at the round that brought the specialist in and in the record it left behind.
    const opened = events.find((event) => event.type === 'round.opened')
    expect(opened?.type === 'round.opened' && opened.data.brought).toEqual(['shape'])

    const conversation = readConversation(workspaceDir, piece.id, 'c1', conversationSchema)
    expect(conversation?.rounds[0]?.brought).toEqual(['shape'])
  })

  it('leaves `brought` empty when addressing names only specialists already in the cast', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } }, held: true },
    })

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    await room.startRound(workspaceDir, piece.id, 'c1', '@shape a direct question', 'draft text')
    const settled = settlementOf(room, piece.id)
    adapter.release('shape')
    await settled

    const opened = events.find((event) => event.type === 'round.opened')
    expect(opened?.type === 'round.opened' && opened.data.brought).toEqual([])
  })

  it('UX_DESIGN "Every specialist call failed... that call fails too": settles and persists a round with nothing in it at all, without ever emitting an error event', async () => {
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
    const { room } = buildRoom(dataRoot, {
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

/** A conversation whose first round left one applicable suggestion behind, ready to apply. */
function conversationWithRecommendation(): Conversation {
  return {
    id: 'c1',
    rounds: [
      {
        id: 'r1',
        message: 'does the opening earn its length',
        addressed: [],
        brought: [],
        outcome: 'settled',
        participants: [{ participantId: 'shape', result: { kind: 'response', outcome: 'applicableSuggestion', claim: 'cut the second paragraph' } }],
      },
    ],
  }
}

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

  it('produces the manuscript the model returned, calling no participant', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeConversation(workspaceDir, piece.id, 'c1', conversationWithRecommendation())
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } } },
    })

    const result = await room.apply(workspaceDir, piece.id, 'c1', 'r1', 'shape', undefined, 'The cups sat where she left them, twice.')

    expect(result).toEqual({ outcome: 'value', value: { manuscript: 'The cups sat where she left them.' } })
    expect(adapter.promptFor('shape')).toBeUndefined()
    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
    // The room only ever reads the draft from the request, and it never writes one.
    expect(readPiece(workspaceDir, piece.id)?.draft).toBeUndefined()
  })

  it('carries the recommendation and the author\'s constraint, verbatim, into the call', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeConversation(workspaceDir, piece.id, 'c1', conversationWithRecommendation())
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } } },
    })

    await room.apply(workspaceDir, piece.id, 'c1', 'r1', 'shape', 'keep the last line', 'draft text')

    expect(adapter.promptFor('apply')).toContain('cut the second paragraph')
    expect(adapter.promptFor('apply')).toContain('keep the last line')
    expect(adapter.promptFor('apply')).toContain('draft text')
  })

  it('refuses when no such applicable suggestion stands at that identity', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeConversation(workspaceDir, piece.id, 'c1', conversationWithRecommendation())
    const { room } = buildRoom(dataRoot, {})

    // "compression" said nothing in this round at all — no participant record to find.
    await expect(room.apply(workspaceDir, piece.id, 'c1', 'r1', 'compression', undefined, 'draft')).rejects.toThrowError(
      RecommendationNotFoundError,
    )
    // A refused apply never touches the lock: the room is free for the next thing the author does.
    expect(room.snapshot(piece.id)).toBeUndefined()
  })

  it('refuses to apply while a round is in flight for the same piece', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeConversation(workspaceDir, piece.id, 'c1', conversationWithRecommendation())
    const { room, adapter } = buildRoom(dataRoot, {
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } }, held: true },
    })

    await room.startRound(workspaceDir, piece.id, 'c2', 'a message', 'draft text')

    await expect(room.apply(workspaceDir, piece.id, 'c1', 'r1', 'shape', undefined, 'draft')).rejects.toThrowError(RoomBusyError)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('refuses to open a round while an application is in flight', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeConversation(workspaceDir, piece.id, 'c1', conversationWithRecommendation())
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })

    const applying = room.apply(workspaceDir, piece.id, 'c1', 'r1', 'shape', undefined, 'draft')

    await expect(room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')).rejects.toThrowError(RoomBusyError)

    adapter.release('apply')
    await applying
  })

  it('resolves as abandoned, and leaves the recommendation applicable, when abandoned mid-call', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeConversation(workspaceDir, piece.id, 'c1', conversationWithRecommendation())
    const { room, adapter } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'value', value: { manuscript: 'revised' } }, held: true },
    })

    const applying = room.apply(workspaceDir, piece.id, 'c1', 'r1', 'shape', undefined, 'draft text')
    room.abandon(piece.id)
    await expect(applying).resolves.toEqual({ outcome: 'abandoned' })

    // The lock released, and the recommendation was never touched — a second
    // attempt reaches the model the same way the first did.
    expect(room.snapshot(piece.id)).toBeUndefined()
    adapter.release('apply')
    const second = await room.apply(workspaceDir, piece.id, 'c1', 'r1', 'shape', undefined, 'draft text')
    expect(second).toEqual({ outcome: 'value', value: { manuscript: 'revised' } })
  })

  it('changes nothing on a failed call, and leaves the recommendation applicable', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    await writeConversation(workspaceDir, piece.id, 'c1', conversationWithRecommendation())
    const { room } = buildRoom(dataRoot, {
      apply: { result: { outcome: 'failed', reason: 'unconfigured' } },
    })

    const failed = await room.apply(workspaceDir, piece.id, 'c1', 'r1', 'shape', undefined, 'draft text')
    expect(failed).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(room.snapshot(piece.id)).toBeUndefined()
    expect(readPiece(workspaceDir, piece.id)?.draft).toBeUndefined()
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
