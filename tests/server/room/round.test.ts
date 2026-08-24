import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHARTER_FIXTURE } from '../../support/charter.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { ModeDescriptor } from '../../../src/server/modes.js'
import { createPiece } from '../../../src/server/pieces.js'
import { Room, type RoomEvent } from '../../../src/server/room/room.js'
import { readConversation, writePieceCast } from '../../../src/server/store/index.js'
import { conversationSchema, type RoundParticipantRecord } from '../../../src/shared/conversationViews.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../../support/modelAdapter.js'
import { buildTestRoom } from '../../support/room.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'reasons about omission' }
const editor: RoleDefinition = { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'holistic' }

const roles = [shape, compression, editor]

const mode: ModeDescriptor = {
  id: 'flash',
  name: 'Flash',
  cast: [
    { id: 'shape', attendsTo: 'the entry point and the turn', defect: 'a middle presented as an ending' },
    { id: 'compression', attendsTo: 'word choice and omission', defect: 'a sentence an omission would do better' },
  ],
}

const charter = CHARTER_FIXTURE

type RoundOptions = Readonly<{
  message?: string
  cast?: readonly string[]
  whileInFlight?: (abandon: () => void) => void
  authorContextYaml?: string
  storyContextYaml?: string
}>

type RoundOutcome = Readonly<{
  events: readonly RoomEvent[]
  roster: readonly string[]
  landed: readonly string[]
  closed: string | undefined
  records: readonly RoundParticipantRecord[]
  adapter: FixtureModelAdapter
}>

describe('the round the room runs', () => {
  let dataRoot: string
  let workspaceDir: string

  beforeEach(() => {
    dataRoot = mkdtempSync(path.join(tmpdir(), 'studio-round-'))
    workspaceDir = path.join(dataRoot, 'my-writing')
    mkdirSync(workspaceDir)
  })

  afterEach(() => {
    rmSync(dataRoot, { recursive: true, force: true })
  })

  async function round(behaviors: Readonly<Record<string, FixtureBehavior>>, options: RoundOptions = {}): Promise<RoundOutcome> {
    const piece = await createPiece(workspaceDir, 'Cups', mode)
    if (options.cast !== undefined) await writePieceCast(workspaceDir, piece.id, options.cast)
    if (options.authorContextYaml !== undefined) {
      mkdirSync(path.join(dataRoot, 'config'), { recursive: true })
      writeFileSync(path.join(dataRoot, 'config', 'author-context.yaml'), options.authorContextYaml, 'utf8')
    }
    if (options.storyContextYaml !== undefined) {
      writeFileSync(path.join(workspaceDir, piece.id, 'story-context.yaml'), options.storyContextYaml, 'utf8')
    }

    const adapter = FixtureModelAdapter.bySite(behaviors, undefined)
    const room = buildTestRoom(dataRoot, { mode, roles, charter, modelAccess: adapter })

    const events: RoomEvent[] = []
    room.subscribe(piece.id, (event) => events.push(event))

    const { conversationId } = await room.startRound(workspaceDir, piece.id, 'c1', options.message, 'text')
    const settlement = room.settlement(piece.id)
    if (settlement === undefined) {
      if (!events.some((event) => event.type === 'round.closed')) throw new Error('no round in flight')
    } else {
      options.whileInFlight?.(() => room.abandon(piece.id))
      await settlement
    }

    const opened = events.find((event) => event.type === 'round.opened')
    const closed = events.find((event) => event.type === 'round.closed')
    const conversation = readConversation(workspaceDir, piece.id, conversationId, conversationSchema)

    return {
      events,
      roster: opened?.data.participants ?? [],
      landed: events.filter((event) => event.type === 'participant.settled').map((event) => event.data.participantId),
      closed: closed?.data.outcome,
      records: conversation?.rounds[0]?.participants ?? [],
      adapter,
    }
  }

  it('announces the cast in order with the Story Editor last, and calls them in the order it announced', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the opening is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room agrees the opening is late' } } },
    })

    expect(outcome.roster).toEqual(['shape', 'compression', 'story-editor'])
    expect(outcome.landed).toEqual(['shape', 'compression', 'story-editor'])
    expect(outcome.closed).toBe('settled')
    expect(outcome.records.map((record) => record.participantId)).toEqual(['shape', 'compression', 'story-editor'])
  })

  it('carries a reading that landed this round into the Story Editor\'s call', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the opening is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room agrees' } } },
    })

    expect(outcome.adapter.promptFor('story-editor')).toContain('the opening is late')
  })

  it('tells each specialist the mode\'s criteria for it, and no other specialist\'s', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    expect(outcome.adapter.promptFor('shape')).toContain('the entry point and the turn')
    expect(outcome.adapter.promptFor('shape')).toContain('a middle presented as an ending')
    expect(outcome.adapter.promptFor('shape')).not.toContain('word choice and omission')

    expect(outcome.adapter.promptFor('compression')).toContain('word choice and omission')
    expect(outcome.adapter.promptFor('compression')).not.toContain('the entry point and the turn')

    expect(outcome.adapter.promptFor('story-editor')).not.toContain('the entry point and the turn')
    expect(outcome.adapter.promptFor('story-editor')).not.toContain('word choice and omission')
  })

  it('carries both durable contexts into every participant\'s call, as the author wrote them', async () => {
    const outcome = await round(
      {
        shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
        compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
        'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
      },
      {
        authorContextYaml: 'Patterns disliked:\n  - rhetorical questions in narration\n',
        storyContextYaml: 'Premise:\n  - two cups, one left behind\n',
      },
    )

    for (const participantId of ['shape', 'compression', 'story-editor']) {
      const prompt = outcome.adapter.promptFor(participantId)
      expect(prompt).toContain('## Author context')
      expect(prompt).toContain('rhetorical questions in narration')
      expect(prompt).toContain('## Story context')
      expect(prompt).toContain('two cups, one left behind')
    }
  })

  it('names neither durable context when the author has written neither', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    expect(outcome.adapter.promptFor('shape')).not.toContain('Author context')
    expect(outcome.adapter.promptFor('shape')).not.toContain('Story context')
  })

  it('closes the round as failed, naming the failure, when a durable context cannot be read', async () => {
    const outcome = await round(
      { shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } } },
      { storyContextYaml: 'Premise: 42\n' },
    )

    expect(outcome.closed).toBe('failed')
    expect(outcome.events.find((event) => event.type === 'error')?.data).toMatchObject({ code: 'CONTEXT_UNREADABLE' })
    expect(outcome.adapter.promptFor('shape')).toBeUndefined()
  })

  it('calls only the addressed participant when the message names one, and no Story Editor', async () => {
    const outcome = await round(
      { shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } } },
      { message: '@shape does the opening earn its length' },
    )

    expect(outcome.roster).toEqual(['shape'])
    expect(outcome.records).toEqual([
      { participantId: 'shape', result: { kind: 'failed', reason: 'nonconforming', returned: '{"outcome":"noComment"}' } },
    ])
  })

  it('owes the Story Editor an answer when nothing substantive landed, and refuses a reply saying nothing', async () => {
    const outcome = await round(
      {
        shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
        'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      },
      { cast: ['shape'] },
    )

    expect(outcome.records[1]).toEqual({
      participantId: 'story-editor',
      result: { kind: 'failed', reason: 'nonconforming', returned: '{"outcome":"noComment"}' },
    })
  })

  it('owes the Story Editor nothing when a reading landed, and admits its no comment', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the opening is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    expect(outcome.records[2]).toEqual({ participantId: 'story-editor', result: { kind: 'response', outcome: 'noComment' } })
  })

  it('stops at the call in flight on abandonment: later calls are never issued and the Story Editor is never attempted', async () => {
    const outcome = await round(
      {
        shape: { result: { outcome: 'value', value: { outcome: 'noComment' } }, held: true },
        compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
        'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      },
      { whileInFlight: (abandon) => abandon() },
    )

    expect(outcome.closed).toBe('abandoned')
    expect(outcome.records).toEqual([{ participantId: 'shape', result: { kind: 'abandoned' } }])
    expect(outcome.adapter.promptFor('compression')).toBeUndefined()
    expect(outcome.adapter.promptFor('story-editor')).toBeUndefined()
  })

  it('UX_DESIGN "A quiet round": settles ordinarily when every specialist has nothing material, and the Story Editor answers anyway', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } } },
    })

    expect(outcome.closed).toBe('settled')
    expect(outcome.records.map((record) => record.result.kind)).toEqual(['response', 'response', 'response'])
  })

  it('UX_DESIGN "Every specialist call failed": settles with the failures stated and the Story Editor\'s answer standing beside them', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'timeout' } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading with nothing from the room to lean on' } } },
    })

    expect(outcome.closed).toBe('settled')
    expect(outcome.records[0]).toEqual({ participantId: 'shape', result: { kind: 'failed', reason: 'unconfigured' } })
    expect(outcome.records[1]).toEqual({ participantId: 'compression', result: { kind: 'failed', reason: 'timeout' } })
    expect(outcome.records[2]?.result.kind).toBe('response')
    expect(outcome.adapter.promptFor('story-editor')).not.toContain('unconfigured')
    expect(outcome.adapter.promptFor('story-editor')).not.toContain('timeout')
  })

  it('UX_DESIGN "Every specialist call failed... that call fails too": a round with nothing in it at all still settles, rather than erroring', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'unreachable' } },
      'story-editor': { result: { outcome: 'failed', reason: 'nonconforming', returned: 'not json' } },
    })

    expect(outcome.closed).toBe('settled')
    expect(outcome.records).toEqual([
      { participantId: 'shape', result: { kind: 'failed', reason: 'unconfigured' } },
      { participantId: 'compression', result: { kind: 'failed', reason: 'unreachable' } },
      { participantId: 'story-editor', result: { kind: 'failed', reason: 'nonconforming', returned: 'not json' } },
    ])
  })

  it('reports a specialist\'s failure plainly and still reaches the Story Editor over the readings that did land', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'failed', reason: 'nonconforming', returned: 'garbage' } },
      compression: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the last sentence' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the cut sentence is the fix' } } },
    })

    expect(outcome.closed).toBe('settled')
    expect(outcome.records[0]).toEqual({ participantId: 'shape', result: { kind: 'failed', reason: 'nonconforming', returned: 'garbage' } })
    expect(outcome.adapter.promptFor('story-editor')).toContain('cut the last sentence')
  })
})
