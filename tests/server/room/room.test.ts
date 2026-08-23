import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { CHARTER_FIXTURE } from '../../fixtures/charter.js'
import { ModelAccess } from '../../../src/server/model/modelAccess.js'
import type { CallResult, CallState, ModelAdapter } from '../../../src/server/model/types.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece } from '../../../src/server/pieces.js'
import { readConversation, readPiece } from '../../../src/server/store/index.js'
import { conversationSchema } from '../../../src/shared/conversationViews.js'
import type { RuntimeStatus } from '../../../src/shared/runtimeStatus.js'
import { Room, RoomBusyError } from '../../../src/server/room/room.js'

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
 * Scripted per site (assignment), and a call can be held open until the test
 * releases it — the shape a busy-refusal test needs, which a fire-and-forget
 * fixture cannot give. `release` may be called before the round ever reaches
 * that site — calls are sequential, so a test releasing every site upfront
 * must not lose the release racing against `invoke` registering its gate.
 */
class GatedAdapter implements ModelAdapter {
  readonly #released = new Set<string>()
  readonly #gates = new Map<string, () => void>()
  readonly #results: Record<string, CallResult<unknown>>

  constructor(results: Record<string, CallResult<unknown>>) {
    this.#results = results
  }

  async invoke<T>(assignment: string, _prompt: string, schema: z.ZodType<T>, signal: AbortSignal, onState?: (state: CallState) => void): Promise<CallResult<T>> {
    onState?.('working')
    if (!this.#released.has(assignment)) {
      await new Promise<void>((resolve) => {
        this.#gates.set(assignment, resolve)
        signal.addEventListener('abort', () => resolve(), { once: true })
      })
    }
    if (signal.aborted) return { outcome: 'abandoned' }
    const result = this.#results[assignment]
    if (result === undefined) throw new Error(`no scripted result for "${assignment}"`)
    if (result.outcome !== 'value') return result as CallResult<T>
    return { outcome: 'value', value: schema.parse(result.value) }
  }

  release(assignment: string): void {
    this.#released.add(assignment)
    this.#gates.get(assignment)?.()
  }

  async status(): Promise<RuntimeStatus> {
    return { reachable: true, models: [] }
  }
}

function buildRoom(adapter: ModelAdapter) {
  const modelAccess = new ModelAccess(adapter, (site) => site)
  return new Room(modelAccess, fixtureRoles, CHARTER_FIXTURE, fixtureMode)
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
    const adapter = new GatedAdapter({})
    const room = buildRoom(adapter)

    await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')

    await expect(room.startRound(workspaceDir, piece.id, 'c1', 'another message', 'draft text')).rejects.toThrowError(RoomBusyError)

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
  })

  it('creates the conversation file only once the first round has settled, not before', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const adapter = new GatedAdapter({
      shape: { outcome: 'value', value: { outcome: 'noComment' } },
      compression: { outcome: 'value', value: { outcome: 'noComment' } },
      'story-editor': { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } },
    })
    const room = buildRoom(adapter)

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
    expect(conversation?.rounds[0]?.participants.map((p) => p.participantId)).toEqual(['shape', 'compression', 'story-editor'])
  })

  it('calls the enabled cast, then the Story Editor, on a round that names no one', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const adapter = new GatedAdapter({
      shape: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry is late' } },
      compression: { outcome: 'value', value: { outcome: 'noComment' } },
      'story-editor': { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } },
    })
    const room = buildRoom(adapter)

    const events: string[] = []
    room.subscribe(piece.id, (event) => {
      if (event.type === 'round.opened') events.push(`opened:${event.data.participants.join(',')}`)
      if (event.type === 'participant.state') events.push(`state:${event.data.participantId}:${event.data.state}`)
      if (event.type === 'participant.settled') events.push(`settled:${event.data.participantId}`)
      if (event.type === 'round.closed') events.push(`closed:${event.data.outcome}`)
    })

    await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    expect(events[0]).toBe('opened:shape,compression,story-editor')

    adapter.release('shape')
    adapter.release('compression')
    adapter.release('story-editor')
    await waitForIdle(room, piece.id)

    expect(events).toEqual([
      'opened:shape,compression,story-editor',
      'state:shape:working',
      'settled:shape',
      'state:compression:working',
      'settled:compression',
      'state:story-editor:working',
      'settled:story-editor',
      'closed:settled',
    ])
  })

  it('durably enables a specialist that was addressed but not part of the enabled cast', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    writeFileSync(path.join(workspaceDir, piece.id, 'piece.yaml'), 'title: Cups\nmode: flash\nstatus: drafting\ncast:\n  - compression\n', 'utf8')

    const adapter = new GatedAdapter({ shape: { outcome: 'value', value: { outcome: 'commentary', claim: 'concrete note' } } })
    const room = buildRoom(adapter)

    await room.startRound(workspaceDir, piece.id, 'c1', '@shape a direct question', 'draft text')
    adapter.release('shape')
    await waitForIdle(room, piece.id)

    const updated = readPiece(workspaceDir, piece.id)
    expect(updated?.metadata.cast.sort()).toEqual(['compression', 'shape'])
  })

  it('settles an abandoned round with whatever landed, and calls no Story Editor', async () => {
    const piece = await createPiece(workspaceDir, 'Cups', fixtureMode)
    const adapter = new GatedAdapter({})
    const room = buildRoom(adapter)

    const { conversationId } = await room.startRound(workspaceDir, piece.id, 'c1', 'a message', 'draft text')
    room.abandon(piece.id)
    await waitForIdle(room, piece.id)

    const conversation = readConversation(workspaceDir, piece.id, conversationId, conversationSchema)
    expect(conversation?.rounds[0]?.outcome).toBe('abandoned')
    expect(conversation?.rounds[0]?.participants.map((p) => p.participantId)).toEqual(['shape'])
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
