import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createLogger } from '../../../src/server/logger.js'
import { eligibleResponseValueSchema, owedResponseValueSchema } from '../../../src/shared/participantResponse.js'

const { modelFn, completeFn, listModelsFn } = vi.hoisted(() => ({
  modelFn: vi.fn(),
  completeFn: vi.fn(),
  listModelsFn: vi.fn(),
}))

vi.mock('@lmstudio/sdk', () => ({
  LMStudioClient: class {
    llm = { model: modelFn }
    system = { listDownloadedModels: listModelsFn }
  },
}))

const { LMStudioAdapter, ModelRuntimeUrlError } = await import('../../../src/server/model/lmStudioAdapter.js')

const schema = z.object({ claim: z.string() })

/** Every site assigned the same model, for a test about something other than assignment. */
const assigned = () => 'llama-3'

/**
 * The product's own logger at the level the studio silences with. Every test here
 * is about what a call *returns*; what it writes to stderr is the same decision
 * made in the same place, and asserting it here would be asserting pino.
 */
const silent = createLogger('silent')

beforeEach(() => {
  modelFn.mockReset()
  completeFn.mockReset()
  listModelsFn.mockReset()
  vi.restoreAllMocks()
})

describe('the runtime URL the adapter is constructed with', () => {
  it('accepts the two schemes the runtime is reachable over', () => {
    expect(() => new LMStudioAdapter('ws://localhost:1234', assigned, silent)).not.toThrow()
    expect(() => new LMStudioAdapter('wss://studio.local:1234', assigned, silent)).not.toThrow()
  })

  it('refuses the plausible wrong scheme, naming the variable and what was wrong with it', () => {
    expect(() => new LMStudioAdapter('http://localhost:1234', assigned, silent)).toThrowError(ModelRuntimeUrlError)
    expect(() => new LMStudioAdapter('http://localhost:1234', assigned, silent)).toThrowError(/STUDIO_MODEL_RUNTIME_URL/)
    expect(() => new LMStudioAdapter('http://localhost:1234', assigned, silent)).toThrowError(/must be ws or wss, not http/)
  })

  it('refuses a value that is not a URL at all', () => {
    expect(() => new LMStudioAdapter('localhost:1234', assigned, silent)).toThrowError(ModelRuntimeUrlError)
    expect(() => new LMStudioAdapter('localhost:1234', assigned, silent)).toThrowError(/STUDIO_MODEL_RUNTIME_URL/)
  })

  it('refuses before anything vendor-owned is constructed, so no vendor message reaches the author', () => {
    let thrown: unknown
    try {
      new LMStudioAdapter('http://localhost:4000', assigned, silent)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(ModelRuntimeUrlError)
    expect(String(thrown)).not.toContain('LMStudioClient')
    expect(String(thrown)).not.toContain('baseUrl')
  })
})

describe('which model a call site is assigned', () => {
  it('fails as unconfigured without contacting the runtime when a site has no assignment', async () => {
    const adapter = new LMStudioAdapter('ws://localhost:1234', () => undefined, silent)

    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(modelFn).not.toHaveBeenCalled()
  })

  it('never falls back to another assignment: an unconfigured site fails even when others are assigned', async () => {
    const adapter = new LMStudioAdapter(
      'ws://localhost:1234',
      (site) => (site === 'story-editor' ? 'qwen-14b' : undefined),
      silent,
    )

    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(modelFn).not.toHaveBeenCalled()
  })

  it('asks the runtime for the model the site is assigned, and not for the site', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn.mockResolvedValue({ content: JSON.stringify({ claim: 'x' }) })

    const adapter = new LMStudioAdapter('ws://localhost:1234', (site) => (site === 'shape' ? 'qwen-14b' : undefined), silent)
    await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(modelFn).toHaveBeenCalledWith('qwen-14b', expect.anything())
  })
})

describe('LMStudioAdapter.call', () => {
  it('re-issues a nonconforming response under its own retry policy and returns the value once it conforms', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn
      .mockResolvedValueOnce({ content: 'not json' })
      .mockResolvedValueOnce({ content: JSON.stringify({ claim: 'the room agrees' }) })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'value', value: { claim: 'the room agrees' } })
    expect(completeFn).toHaveBeenCalledTimes(2)
  })

  it('fails as nonconforming, carrying verbatim what came back, once the retry policy is exhausted', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn.mockResolvedValue({ content: 'still not json' })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'nonconforming', returned: 'still not json' })
    expect(completeFn).toHaveBeenCalledTimes(3) // one attempt plus two retries
  })

  /**
   * A runtime that never answers is the failure the author meets when LM Studio
   * is not running, and it is `unreachable` rather than `nonconforming`: nothing
   * came back to not conform. The retry policy is exhausted first, so a single
   * dropped connection is not reported as an absent runtime.
   */
  it('fails as unreachable, and only after exhausting its retry policy, when the runtime never answers', async () => {
    modelFn.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1234'))

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'unreachable' })
    expect(modelFn).toHaveBeenCalledTimes(3) // one attempt plus two retries
  })

  it('states nothing about the runtime it could not reach beyond the reason', async () => {
    modelFn.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1234'))

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(Object.keys(result)).toEqual(['outcome', 'reason'])
  })

  /**
   * The timeout is this module's own policy and is not a parameter on a call, so
   * the platform's timeout factory is what a test substitutes rather than the
   * adapter's construction — which also lets the stated bound itself be
   * asserted. Fake timers would not reach it: `AbortSignal.timeout` is timed
   * inside the platform rather than on the JavaScript timer queue.
   */
  it('fails as timeout, distinctly from unreachable, when its own bound elapses', async () => {
    const timeout = new AbortController()
    const spy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    modelFn.mockImplementation(() => new Promise(() => {}))

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const pending = adapter.call('shape', 'prompt', schema, new AbortController().signal)
    timeout.abort()

    expect(await pending).toEqual({ outcome: 'failed', reason: 'timeout' })
    expect(spy).toHaveBeenCalledWith(120_000)
  })

  it('reports an abandoned call as abandoned even where its own bound also elapsed', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    modelFn.mockImplementation(() => new Promise(() => {}))
    const author = new AbortController()

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const pending = adapter.call('shape', 'prompt', schema, author.signal)
    author.abort()
    timeout.abort()

    expect(await pending).toEqual({ outcome: 'abandoned' })
  })

  it('returns an ordinary value with no record of having taken more than one attempt', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn
      .mockResolvedValueOnce({ content: 'garbage' })
      .mockResolvedValueOnce({ content: JSON.stringify({ claim: 'second try' }) })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(Object.keys(result)).toEqual(['outcome', 'value'])
  })

  it('resolves an abandoned call as abandoned, not as a nonconforming failure, and does not retry it', async () => {
    const controller = new AbortController()
    modelFn.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        }),
    )

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const pending = adapter.call('shape', 'prompt', schema, controller.signal)
    controller.abort()

    expect(await pending).toEqual({ outcome: 'abandoned' })
    expect(completeFn).not.toHaveBeenCalled()
  })

  it('reports preparing before working, in order, ahead of the settled outcome', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn.mockResolvedValue({ content: JSON.stringify({ claim: 'x' }) })
    const states: string[] = []

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    await adapter.call('shape', 'prompt', schema, new AbortController().signal, (state) => states.push(state))

    expect(states).toEqual(['preparing', 'working'])
  })
})

describe('LMStudioAdapter.call against the participant response schemas', () => {
  it('refuses a reply that says something but states no claim', async () => {
    const returned = JSON.stringify({ outcome: 'commentary' })
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn.mockResolvedValue({ content: returned })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', eligibleResponseValueSchema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'nonconforming', returned })
  })

  it('refuses a no-comment reply from a participant that owes an answer', async () => {
    const returned = JSON.stringify({ outcome: 'noComment' })
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn.mockResolvedValue({ content: returned })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', owedResponseValueSchema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'nonconforming', returned })
  })
})

describe('LMStudioAdapter.status', () => {
  it('reports the runtime unreachable rather than throwing', async () => {
    listModelsFn.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1234'))

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)

    expect(await adapter.status()).toEqual({ reachable: false })
  })

  /**
   * The models a reachable runtime holds are reported by the key a call site is
   * assigned by, not by the display name the runtime also carries — an author
   * choosing from this list is choosing the value an assignment is written with.
   */
  it('reports each downloaded model by the key an assignment names it with', async () => {
    listModelsFn.mockResolvedValue([
      { modelKey: 'llama-3.2-3b', displayName: 'Llama 3.2 3B' },
      { modelKey: 'qwen2.5-14b', displayName: 'Qwen2.5 14B' },
    ])

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)

    expect(await adapter.status()).toEqual({ reachable: true, models: ['llama-3.2-3b', 'qwen2.5-14b'] })
  })

  it('asks the runtime only for the models a call can be assigned', async () => {
    listModelsFn.mockResolvedValue([])

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    await adapter.status()

    expect(listModelsFn).toHaveBeenCalledWith('llm')
  })
})
