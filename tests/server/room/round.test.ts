import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Charter } from '../../../src/server/model/charter.js'
import { ModelAccess } from '../../../src/server/model/modelAccess.js'
import type { CallResult, CallState, ModelAdapter } from '../../../src/server/model/types.js'
import type { RoleDefinition } from '../../../src/server/model/roles.js'
import type { RuntimeStatus } from '../../../src/shared/runtimeStatus.js'
import { runRound, type RoundPlan } from '../../../src/server/room/round.js'

const shape: RoleDefinition = { id: 'shape', handle: 'shape', displayName: 'Shape', roleDescription: 'reasons about the turn' }
const compression: RoleDefinition = { id: 'compression', handle: 'compression', displayName: 'Compression', roleDescription: 'reasons about omission' }
const editor: RoleDefinition = { id: 'story-editor', handle: 'editor', displayName: 'Story Editor', roleDescription: 'holistic' }

const charter: Charter = {
  outcomes: {
    noComment: 'nothing material to contribute',
    commentary: 'a reading without a concrete action',
    applicableSuggestion: 'a recommendation concrete enough to apply',
  },
  directQuestionOwedAnswer: 'a participant addressed directly answers',
  noReasoningAboutTheAuthorsQuestion: 'nothing remarks on how the question was phrased',
}

/** A test-local adapter, scripted per call site (the assignment, since `getAssignment` below maps a site to itself) rather than one shared default. */
class ScriptedAdapter implements ModelAdapter {
  readonly prompts: Record<string, string> = {}
  constructor(
    private readonly bySite: Record<string, CallResult<unknown>>,
    private readonly states: Record<string, readonly CallState[]> = {},
    private readonly onInvoke?: (assignment: string) => void,
  ) {}

  async invoke<T>(assignment: string, prompt: string, schema: z.ZodType<T>, signal: AbortSignal, onState?: (state: CallState) => void): Promise<CallResult<T>> {
    this.prompts[assignment] = prompt
    this.onInvoke?.(assignment)
    for (const state of this.states[assignment] ?? []) onState?.(state)
    if (signal.aborted) return { outcome: 'abandoned' }
    const result = this.bySite[assignment]
    if (result === undefined) throw new Error(`no scripted result for "${assignment}"`)
    if (result.outcome !== 'value') return result as CallResult<T>
    return { outcome: 'value', value: schema.parse(result.value) }
  }

  async status(): Promise<RuntimeStatus> {
    return { reachable: true, models: [] }
  }
}

function access(adapter: ScriptedAdapter) {
  return new ModelAccess(adapter, (site) => site)
}

describe('runRound', () => {
  it('calls specialists in the cast order, then the Story Editor last, with the round\'s substantive readings as evidence', async () => {
    const adapter = new ScriptedAdapter({
      shape: { outcome: 'value', value: { outcome: 'commentary', claim: 'the opening is late' } },
      compression: { outcome: 'value', value: { outcome: 'noComment' } },
      'story-editor': { outcome: 'value', value: { outcome: 'commentary', claim: 'the room agrees the opening is late' } },
    })

    const plan: RoundPlan = {
      roundId: 'r1',
      message: 'does the opening earn its length',
      addressedIds: [],
      specialists: [shape, compression],
      storyEditor: editor,
    }

    const events: string[] = []
    const result = await runRound({
      plan,
      draft: 'text',
      authorContext: undefined,
      storyContext: undefined,
      conversation: undefined,
      policy: 'shared',
      charter,
      modelAccess: access(adapter),
      signal: new AbortController().signal,
      callbacks: {
        onState: () => {},
        onSettled: (participantId) => events.push(participantId),
      },
    })

    expect(events).toEqual(['shape', 'compression', 'story-editor'])
    expect(result.outcome).toBe('settled')
    expect(result.participants.map((p) => p.participantId)).toEqual(['shape', 'compression', 'story-editor'])

    // The Story Editor's prompt carries Shape's substantive reading as evidence...
    expect(adapter.prompts['story-editor']).toContain('the opening is late')
    // ...but Compression's no-comment outcome is not a reading and never reaches it.
    expect(adapter.prompts['story-editor']).not.toContain('noComment')
  })

  it('never lets a later specialist\'s prompt contain an earlier specialist\'s response from the same round', async () => {
    const adapter = new ScriptedAdapter({
      shape: { outcome: 'value', value: { outcome: 'commentary', claim: 'a claim only Shape should ever see reflected back' } },
      compression: { outcome: 'value', value: { outcome: 'noComment' } },
      'story-editor': { outcome: 'value', value: { outcome: 'noComment' } },
    })

    const plan: RoundPlan = {
      roundId: 'r1',
      message: 'a message',
      addressedIds: [],
      specialists: [shape, compression],
      storyEditor: editor,
    }

    await runRound({
      plan,
      draft: 'text',
      authorContext: undefined,
      storyContext: undefined,
      conversation: undefined,
      policy: 'shared',
      charter,
      modelAccess: access(adapter),
      signal: new AbortController().signal,
      callbacks: { onState: () => {}, onSettled: () => {} },
    })

    expect(adapter.prompts.compression).not.toContain('a claim only Shape should ever see reflected back')
  })

  it('calls only the addressed participant when the round names one, and no Story Editor', async () => {
    const adapter = new ScriptedAdapter({
      shape: { outcome: 'value', value: { outcome: 'commentary', claim: 'the entry costs more than it buys' } },
    })

    const plan: RoundPlan = {
      roundId: 'r1',
      message: '@shape does the opening earn its length',
      addressedIds: ['shape'],
      specialists: [shape],
      storyEditor: undefined,
    }

    const result = await runRound({
      plan,
      draft: 'text',
      authorContext: undefined,
      storyContext: undefined,
      conversation: undefined,
      policy: 'shared',
      charter,
      modelAccess: access(adapter),
      signal: new AbortController().signal,
      callbacks: { onState: () => {}, onSettled: () => {} },
    })

    expect(result.participants.map((p) => p.participantId)).toEqual(['shape'])
    expect(adapter.prompts.shape).toContain(charter.directQuestionOwedAnswer)
  })

  it('owes the Story Editor an answer when nothing substantive landed from the specialists', async () => {
    const adapter = new ScriptedAdapter({
      shape: { outcome: 'value', value: { outcome: 'noComment' } },
      'story-editor': { outcome: 'value', value: { outcome: 'commentary', claim: 'the room has a reading anyway' } },
    })

    const plan: RoundPlan = { roundId: 'r1', message: 'a message', addressedIds: [], specialists: [shape], storyEditor: editor }

    await runRound({
      plan,
      draft: 'text',
      authorContext: undefined,
      storyContext: undefined,
      conversation: undefined,
      policy: 'shared',
      charter,
      modelAccess: access(adapter),
      signal: new AbortController().signal,
      callbacks: { onState: () => {}, onSettled: () => {} },
    })

    expect(adapter.prompts['story-editor']).toContain(charter.directQuestionOwedAnswer)
  })

  it('stops at the call in flight on abandonment: later calls are never issued and the Story Editor is never attempted', async () => {
    const controller = new AbortController()
    // The abort fires the instant Shape's call starts — simulating the author
    // abandoning while that call is the one in flight — so it settles as
    // abandoned and nothing after it in the cast's order is ever called.
    const adapter = new ScriptedAdapter(
      {
        compression: { outcome: 'value', value: { outcome: 'noComment' } },
        'story-editor': { outcome: 'value', value: { outcome: 'noComment' } },
      },
      {},
      (assignment) => {
        if (assignment === 'shape') controller.abort()
      },
    )

    const plan: RoundPlan = {
      roundId: 'r1',
      message: 'a message',
      addressedIds: [],
      specialists: [shape, compression],
      storyEditor: editor,
    }

    const result = await runRound({
      plan,
      draft: 'text',
      authorContext: undefined,
      storyContext: undefined,
      conversation: undefined,
      policy: 'shared',
      charter,
      modelAccess: access(adapter),
      signal: controller.signal,
      callbacks: { onState: () => {}, onSettled: () => {} },
    })

    expect(result.outcome).toBe('abandoned')
    expect(result.participants).toEqual([{ participantId: 'shape', result: { kind: 'abandoned' } }])
    expect(adapter.prompts.compression).toBeUndefined()
    expect(adapter.prompts['story-editor']).toBeUndefined()
  })

  it('reports a specialist\'s failure plainly and still reaches the Story Editor over the readings that did land', async () => {
    const adapter = new ScriptedAdapter({
      shape: { outcome: 'failed', reason: 'nonconforming', returned: 'garbage' },
      compression: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim: 'cut the last sentence' } },
      'story-editor': { outcome: 'value', value: { outcome: 'commentary', claim: 'the cut sentence is the fix' } },
    })

    const plan: RoundPlan = {
      roundId: 'r1',
      message: 'a message',
      addressedIds: [],
      specialists: [shape, compression],
      storyEditor: editor,
    }

    const result = await runRound({
      plan,
      draft: 'text',
      authorContext: undefined,
      storyContext: undefined,
      conversation: undefined,
      policy: 'shared',
      charter,
      modelAccess: access(adapter),
      signal: new AbortController().signal,
      callbacks: { onState: () => {}, onSettled: () => {} },
    })

    expect(result.outcome).toBe('settled')
    expect(result.participants[0]).toEqual({ participantId: 'shape', result: { kind: 'failed', reason: 'nonconforming', returned: 'garbage' } })
    expect(adapter.prompts['story-editor']).toContain('cut the last sentence')
  })
})
