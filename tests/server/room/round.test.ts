import { describe, expect, it } from 'vitest'
import { CHARTER_FIXTURE } from '../../support/charter.js'
import { ModelAccess } from '../../../src/server/model/modelAccess.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import { runRound, type RoundPlan, type RoundResult } from '../../../src/server/room/round.js'
import { FixtureModelAdapter, type FixtureBehavior } from '../../support/modelAdapter.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'reasons about omission' }
const editor: RoleDefinition = { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'holistic' }

const charter = CHARTER_FIXTURE

/** The round most of these tests plan: the whole cast in order, then the Story Editor, addressing no one. */
const wholeCast: RoundPlan = {
  roundId: 'r1',
  message: 'a message',
  addressedIds: [],
  specialists: [shape, compression],
  storyEditor: editor,
}

type RunOptions = Readonly<{
  plan?: RoundPlan
  signal?: AbortSignal
  onInvoke?: (assignment: string) => void
  onSettled?: (participantId: string) => void
}>

/**
 * One round, run over scripted calls. Everything a round is compiled from
 * beyond the plan and the calls is the same in every test here and is stated
 * once — the author and story contexts absent, no prior conversation, shared
 * history — so what a test varies is the only thing a reader has to read.
 */
async function run(
  behaviors: Readonly<Record<string, FixtureBehavior>>,
  options: RunOptions = {},
): Promise<{ result: RoundResult; adapter: FixtureModelAdapter }> {
  const adapter = FixtureModelAdapter.bySite(behaviors, undefined, options.onInvoke)
  const result = await runRound({
    plan: options.plan ?? wholeCast,
    draft: 'text',
    authorContext: undefined,
    storyContext: undefined,
    conversation: undefined,
    policy: 'shared',
    charter,
    modelAccess: new ModelAccess(adapter, (site) => site),
    signal: options.signal ?? new AbortController().signal,
    callbacks: { onState: () => {}, onSettled: (participantId) => options.onSettled?.(participantId) },
  })
  return { result, adapter }
}

describe('runRound', () => {
  it('calls specialists in the cast order, then the Story Editor last, with the round\'s substantive readings as evidence', async () => {
    const settled: string[] = []
    const { result, adapter } = await run(
      {
        shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the opening is late' } } },
        compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
        'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room agrees the opening is late' } } },
      },
      { onSettled: (participantId) => settled.push(participantId) },
    )

    expect(settled).toEqual(['shape', 'compression', 'story-editor'])
    expect(result.outcome).toBe('settled')
    expect(result.participants.map((p) => p.participantId)).toEqual(['shape', 'compression', 'story-editor'])

    // The Story Editor's prompt carries Shape's substantive reading as evidence...
    expect(adapter.promptFor('story-editor')).toContain('the opening is late')
    // ...and Compression, having had nothing material to say, is not among the
    // readings at all: a no-comment outcome is recorded but is not evidence.
    expect(adapter.promptFor('story-editor')).not.toContain('compression:')
  })

  it('never lets a later specialist\'s prompt contain an earlier specialist\'s response from the same round', async () => {
    const { adapter } = await run({
      shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a claim only Shape should ever see reflected back' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
    })

    expect(adapter.promptFor('compression')).not.toContain('a claim only Shape should ever see reflected back')
  })

  it('calls only the addressed participant when the round names one, and no Story Editor', async () => {
    const { result, adapter } = await run(
      { shape: { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry costs more than it buys' } } } },
      {
        plan: {
          roundId: 'r1',
          message: '@shape does the opening earn its length',
          addressedIds: ['shape'],
          specialists: [shape],
          storyEditor: undefined,
        },
      },
    )

    expect(result.participants.map((p) => p.participantId)).toEqual(['shape'])
    expect(adapter.promptFor('shape')).toContain(charter.directQuestionOwedAnswer)
  })

  it('owes the Story Editor an answer when nothing substantive landed from the specialists', async () => {
    const { adapter } = await run(
      {
        shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
        'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has a reading anyway' } } },
      },
      { plan: { ...wholeCast, specialists: [shape] } },
    )

    expect(adapter.promptFor('story-editor')).toContain(charter.directQuestionOwedAnswer)
  })

  it('stops at the call in flight on abandonment: later calls are never issued and the Story Editor is never attempted', async () => {
    const controller = new AbortController()
    // The abort fires the instant Shape's call starts — simulating the author
    // abandoning while that call is the one in flight — so it settles as
    // abandoned and nothing after it in the cast's order is ever called.
    const { result, adapter } = await run(
      {
        compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
        'story-editor': { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      },
      {
        signal: controller.signal,
        onInvoke: (assignment) => {
          if (assignment === 'shape') controller.abort()
        },
      },
    )

    expect(result.outcome).toBe('abandoned')
    expect(result.participants).toEqual([{ participantId: 'shape', result: { kind: 'abandoned' } }])
    expect(adapter.promptFor('compression')).toBeUndefined()
    expect(adapter.promptFor('story-editor')).toBeUndefined()
  })

  it('UX_DESIGN "A quiet round": settles ordinarily when every specialist has nothing material, and the Story Editor answers anyway', async () => {
    const { result, adapter } = await run({
      shape: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      compression: { result: { outcome: 'value', value: { outcome: 'noComment' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has nothing urgent to add' } } },
    })

    expect(result.outcome).toBe('settled')
    expect(result.participants.map((p) => p.result.kind)).toEqual(['response', 'response', 'response'])
    // Owed an answer because nothing substantive landed from either specialist,
    // and with no readings to weigh the prompt has no readings section at all.
    expect(adapter.promptFor('story-editor')).toContain(charter.directQuestionOwedAnswer)
    expect(adapter.promptFor('story-editor')).not.toContain('Readings from this round')
  })

  it('UX_DESIGN "Every specialist call failed": settles ordinarily with the failures stated and the Story Editor\'s answer standing beside them', async () => {
    const { result, adapter } = await run({
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'timeout' } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'a reading with nothing from the room to lean on' } } },
    })

    expect(result.outcome).toBe('settled')
    expect(result.participants[0]).toEqual({ participantId: 'shape', result: { kind: 'failed', reason: 'unconfigured' } })
    expect(result.participants[1]).toEqual({ participantId: 'compression', result: { kind: 'failed', reason: 'timeout' } })
    expect(result.participants[2]?.result.kind).toBe('response')
    // Owed an answer because a failure is not a reading either, and no failure
    // reaches the Story Editor's prompt as though it were one.
    expect(adapter.promptFor('story-editor')).toContain(charter.directQuestionOwedAnswer)
    expect(adapter.promptFor('story-editor')).not.toContain('Readings from this round')
  })

  it('UX_DESIGN "Every specialist call failed... that call fails too": a round with nothing in it at all still settles, rather than erroring, when the Story Editor fails as well', async () => {
    const { result } = await run({
      shape: { result: { outcome: 'failed', reason: 'unconfigured' } },
      compression: { result: { outcome: 'failed', reason: 'unreachable' } },
      'story-editor': { result: { outcome: 'failed', reason: 'nonconforming', returned: 'not json' } },
    })

    // Nothing landed anywhere in the round, and that is information, not an
    // error: the round still settles, carrying every failure plainly, rather
    // than throwing or reporting itself abandoned.
    expect(result.outcome).toBe('settled')
    expect(result.participants).toEqual([
      { participantId: 'shape', result: { kind: 'failed', reason: 'unconfigured' } },
      { participantId: 'compression', result: { kind: 'failed', reason: 'unreachable' } },
      { participantId: 'story-editor', result: { kind: 'failed', reason: 'nonconforming', returned: 'not json' } },
    ])
  })

  it('reports a specialist\'s failure plainly and still reaches the Story Editor over the readings that did land', async () => {
    const { result, adapter } = await run({
      shape: { result: { outcome: 'failed', reason: 'nonconforming', returned: 'garbage' } },
      compression: { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the last sentence' } } },
      'story-editor': { result: { outcome: 'value', value: { outcome: 'commentary', claim: 'the cut sentence is the fix' } } },
    })

    expect(result.outcome).toBe('settled')
    expect(result.participants[0]).toEqual({ participantId: 'shape', result: { kind: 'failed', reason: 'nonconforming', returned: 'garbage' } })
    expect(adapter.promptFor('story-editor')).toContain('cut the last sentence')
  })
})
