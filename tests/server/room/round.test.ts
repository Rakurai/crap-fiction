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

/**
 * The round, as the room runs it. SPEC "Seams" makes the round loop internal to
 * the room boundary, so every property here is asserted through `Room` at the
 * interface a caller actually has: the roster and its order at `round.opened`,
 * the landing order at each `participant.settled`, the outcome at
 * `round.closed`, and what each participant said in the conversation the round
 * wrote. Nothing here reaches past that to the loop itself.
 */

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'reasons about omission' }
const editor: RoleDefinition = { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'holistic' }

const roles = [shape, compression, editor]

/**
 * The mode's criteria are the author-facing craft language that distinguishes one
 * specialist from another, so they are written out here rather than as filler: a
 * test asserting the right criteria reached the right participant cannot do it
 * against two identical strings.
 */
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
  /** The author's message. Absent means a round opened by an act rather than by typing. */
  message?: string
  /** Which specialists the piece has enabled, when the test needs fewer than the mode's whole cast. */
  cast?: readonly string[]
  /**
   * Called once the round is open and its first call is in flight — the earliest
   * moment a caller of the room could act on a round, since `startRound` returns
   * only after the round is the room's to abandon.
   */
  whileInFlight?: (abandon: () => void) => void
  /**
   * The two durable contexts as the author's own hand-edited YAML, written where
   * the product keeps them, for a test about what a participant is told.
   */
  authorContextYaml?: string
  storyContextYaml?: string
}>

type RoundOutcome = Readonly<{
  /** Every event the room emitted, in order. */
  events: readonly RoomEvent[]
  /** The participants the round announced at open, in the order it said it would call them. */
  roster: readonly string[]
  /** Participant ids in the order their calls settled. */
  landed: readonly string[]
  /** How the round closed. */
  closed: string | undefined
  /** The records the round persisted, which is the room's durable statement of what each participant said. */
  records: readonly RoundParticipantRecord[]
  adapter: FixtureModelAdapter
}>

describe('the round the room runs', () => {
  // The workspace sits inside the data root, as SPEC "Files" draws it: the
  // author context is beside the workspace and a piece's story context is in the
  // piece, so a round reading both needs them nested as the product has them.
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

  /**
   * One round, opened on a real piece and run over scripted calls. Everything a
   * round is compiled from beyond the message and the calls is the same in every
   * test here — a one-line draft, no prior conversation, the shipped history
   * policy — so what a test varies is the only thing a reader has to read.
   */
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
    // A round that fails on an artifact it reads before its first call is
    // already closed by the time `startRound` returns, so there is nothing to
    // wait on; a round with no settlement and no close is a round this helper
    // failed to start.
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

  /**
   * That the round supplies what settled to the Story Editor is the round's own
   * claim. Which readings count as evidence, and how the section holding them is
   * shaped, belong to the compilation boundary and are asserted there — so this
   * asks only that the reading arrived.
   */
  it('carries a reading that landed this round into the Story Editor\'s call', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the opening is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room agrees' } } },
    })

    expect(outcome.adapter.promptFor('story-editor')).toContain('the opening is late')
  })

  /**
   * CONTEXT "Mode": a mode supplies the criteria each specialist applies at that
   * scale, and VISION has each role applying genuinely different criteria. The
   * round is where a mode's criteria meet a participant, so this asserts each
   * specialist was told its own and not its round-mate's — the whole of what makes
   * the room a room rather than one model asked four times.
   */
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

    // The Story Editor is no part of the cast, so no criteria are its to apply.
    expect(outcome.adapter.promptFor('story-editor')).not.toContain('the entry point and the turn')
    expect(outcome.adapter.promptFor('story-editor')).not.toContain('word choice and omission')
  })

  /**
   * CONTEXT "Author context"/"Story context": both are read by every participant
   * on every call, and SPEC "Files" has them re-read when a model call is
   * compiled. The whole point of the room is that each participant answers from
   * the author's own standing instructions rather than as a generic critic, so
   * this asserts the author's own words arrive — in both the specialist's call and
   * the Story Editor's, since neither is exempt.
   */
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

  /**
   * The same property from the other side. An author who has written no context
   * gets no heading for one: SPEC "Model access" omits a section the author has
   * not written entirely, because a model reads an empty section as something to
   * remark on rather than as nothing having been said.
   */
  it('names neither durable context when the author has written neither', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'agreed' } } },
    })

    expect(outcome.adapter.promptFor('shape')).not.toContain('Author context')
    expect(outcome.adapter.promptFor('shape')).not.toContain('Story context')
  })

  /**
   * A hand-edited context file the store refuses is the author's to act on, and
   * the round says so rather than putting the room to work without the standing
   * instructions it is supposed to answer from (SPEC "Files": a stated failure
   * naming the file and the entry, never worked around).
   */
  it('closes the round as failed, naming the failure, when a durable context cannot be read', async () => {
    const outcome = await round(
      { shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } } },
      { storyContextYaml: 'Premise: 42\n' },
    )

    expect(outcome.closed).toBe('failed')
    expect(outcome.events.find((event) => event.type === 'error')?.data).toMatchObject({ code: 'CONTEXT_UNREADABLE' })
    expect(outcome.adapter.promptFor('shape')).toBeUndefined()
  })

  /**
   * Addressing one specialist narrows the round to it — and being addressed is
   * owing an answer, so the reply the owed schema refuses is refused here too.
   */
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

  /**
   * Being owed an answer is not only something a participant is told — it is the
   * schema its call is made against, and a reply saying nothing does not conform
   * to it. This is the property that makes the two schemas actually selected
   * between rather than merely both present: with the eligible schema used
   * unconditionally, a no-comment from a participant that owes an answer would be
   * recorded as an ordinary no comment and the author would never learn the round
   * produced nothing. That the clause telling a participant so also reaches the
   * prompt is the compilation boundary's property and is asserted there.
   */
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

  /**
   * The same property from the other side: with a reading to weigh, the Story
   * Editor owes no answer and may return no comment — which is the reply the
   * owed schema refuses, so a round that admits it here proves the two schemas
   * are actually selected between.
   */
  it('owes the Story Editor nothing when a reading landed, and admits its no comment', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the opening is late' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    expect(outcome.records[2]).toEqual({ participantId: 'story-editor', result: { kind: 'response', outcome: 'noComment' } })
  })

  it('stops at the call in flight on abandonment: later calls are never issued and the Story Editor is never attempted', async () => {
    // Shape's call is held open, so the abandon lands while that call is the one
    // in flight — the author stopping the round — and nothing after it in the
    // cast's order is ever called.
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
    // A failure is not a reading, so nothing of either failed call reaches the
    // Story Editor's call as though it were one.
    expect(outcome.adapter.promptFor('story-editor')).not.toContain('unconfigured')
    expect(outcome.adapter.promptFor('story-editor')).not.toContain('timeout')
  })

  it('UX_DESIGN "Every specialist call failed... that call fails too": a round with nothing in it at all still settles, rather than erroring', async () => {
    const outcome = await round({
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'unreachable' } },
      'story-editor': { result: { outcome: 'failed', reason: 'nonconforming', returned: 'not json' } },
    })

    // Nothing landed anywhere in the round, and that is information, not an
    // error: the round still settles, carrying every failure plainly.
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
