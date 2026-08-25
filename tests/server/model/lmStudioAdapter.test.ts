import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createLogger } from '../../../src/server/logger.js'
import { APPLY_CALL_SITE } from '../../../src/server/model/callSites.js'
import { eligibleResponseValueSchema, owedResponseValueSchema } from '../../../src/shared/participantResponse.js'

const { modelFn, respondFn, listModelsFn } = vi.hoisted(() => ({
  modelFn: vi.fn(),
  respondFn: vi.fn(),
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

const assigned = () => 'llama-3'

const silent = createLogger('silent')

beforeEach(() => {
  modelFn.mockReset()
  respondFn.mockReset()
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
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn.mockResolvedValue({ nonReasoningContent: JSON.stringify({ claim: 'x' }) })

    const adapter = new LMStudioAdapter('ws://localhost:1234', (site) => (site === 'shape' ? 'qwen-14b' : undefined), silent)
    await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(modelFn).toHaveBeenCalledWith('qwen-14b', expect.anything())
  })
})

describe('LMStudioAdapter.call', () => {
  it('re-issues a response that was not JSON under its own retry policy and returns the value once it parses', async () => {
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn
      .mockResolvedValueOnce({ nonReasoningContent: 'not json' })
      .mockResolvedValueOnce({ nonReasoningContent: JSON.stringify({ claim: 'the room agrees' }) })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'value', value: { claim: 'the room agrees' } })
    expect(respondFn).toHaveBeenCalledTimes(2)
  })

  it('fails as malformed, carrying verbatim what came back, once the retry policy is exhausted', async () => {
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn.mockResolvedValue({ nonReasoningContent: 'still not json' })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'malformed', returned: 'still not json' })
    expect(respondFn).toHaveBeenCalledTimes(3)
  })

  it('fails as unreachable, and only after exhausting its retry policy, when the runtime never answers', async () => {
    modelFn.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1234'))

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'unreachable' })
    expect(modelFn).toHaveBeenCalledTimes(3)
  })

  it('states nothing about the runtime it could not reach beyond the reason', async () => {
    modelFn.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1234'))

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(Object.keys(result)).toEqual(['outcome', 'reason'])
  })

  // `AbortSignal.timeout` is timed inside the platform rather than on the JavaScript timer
  // queue, so fake timers do not reach it and the factory itself is substituted.
  it('fails as timeout, distinctly from unreachable, when its own bound elapses', async () => {
    const timeout = new AbortController()
    const spy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    modelFn.mockImplementation(() => new Promise(() => {}))

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const pending = adapter.call('shape', 'prompt', schema, new AbortController().signal)
    await vi.waitFor(() => expect(spy).toHaveBeenCalledWith(120_000))
    timeout.abort()

    expect(await pending).toEqual({ outcome: 'failed', reason: 'timeout' })
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
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn
      .mockResolvedValueOnce({ nonReasoningContent: 'garbage' })
      .mockResolvedValueOnce({ nonReasoningContent: JSON.stringify({ claim: 'second try' }) })

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
    expect(respondFn).not.toHaveBeenCalled()
  })

  it('reports preparing before working, in order, ahead of the settled outcome', async () => {
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn.mockResolvedValue({ nonReasoningContent: JSON.stringify({ claim: 'x' }) })
    const states: string[] = []

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    await adapter.call('shape', 'prompt', schema, new AbortController().signal, (state) => states.push(state))

    expect(states).toEqual(['preparing', 'working'])
  })

  it('states preparing once across a retried call, and working on every attempt', async () => {
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn
      .mockResolvedValueOnce({ nonReasoningContent: 'not json' })
      .mockResolvedValueOnce({ nonReasoningContent: JSON.stringify({ claim: 'x' }) })
    const states: string[] = []

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    await adapter.call('shape', 'prompt', schema, new AbortController().signal, (state) => states.push(state))

    expect(states).toEqual(['preparing', 'working', 'working'])
  })

  it('submits independently but never lets the runtime hold two calls at once: a second submission waits for the first to settle', async () => {
    modelFn.mockResolvedValue({ respond: respondFn })
    let resolveFirst: (value: { nonReasoningContent: string }) => void = () => {}
    respondFn.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    respondFn.mockResolvedValueOnce({ nonReasoningContent: JSON.stringify({ claim: 'second' }) })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const first = adapter.call('shape', 'prompt one', schema, new AbortController().signal)
    const second = adapter.call('compression', 'prompt two', schema, new AbortController().signal)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(respondFn).toHaveBeenCalledTimes(1)

    resolveFirst({ nonReasoningContent: JSON.stringify({ claim: 'first' }) })

    expect(await first).toEqual({ outcome: 'value', value: { claim: 'first' } })
    expect(await second).toEqual({ outcome: 'value', value: { claim: 'second' } })
    expect(respondFn).toHaveBeenCalledTimes(2)
  })
})

describe('what the adapter asks the runtime to generate', () => {
  beforeEach(() => {
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn.mockResolvedValue({ nonReasoningContent: JSON.stringify({ claim: 'x' }) })
  })

  it('constrains generation with the schema converted to JSON Schema, not with the schema object itself', async () => {
    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    const [, options] = respondFn.mock.calls[0] as [string, { structured: { type: string; jsonSchema: object } }]
    expect(options.structured.type).toBe('json')
    expect(options.structured.jsonSchema).toMatchObject({ type: 'object', properties: { claim: { type: 'string' } }, required: ['claim'] })
  })

  it('bounds generation, allowing the site that returns a manuscript far more than the sites that return a reply', async () => {
    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    await adapter.call('shape', 'prompt', schema, new AbortController().signal)
    await adapter.call(APPLY_CALL_SITE, 'prompt', schema, new AbortController().signal)

    const bound = (index: number) => (respondFn.mock.calls[index] as [string, { maxTokens: number }])[1].maxTokens
    expect(bound(0)).toBeGreaterThan(0)
    expect(bound(1)).toBeGreaterThan(bound(0))
  })

  it('reads only the answer, discarding the reasoning a model puts in front of it', async () => {
    respondFn.mockResolvedValue({
      content: `Thinking about the room...${JSON.stringify({ claim: 'the opening is late' })}`,
      reasoningContent: 'Thinking about the room...',
      nonReasoningContent: JSON.stringify({ claim: 'the opening is late' }),
    })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'value', value: { claim: 'the opening is late' } })
    expect(respondFn).toHaveBeenCalledTimes(1)
  })
})

describe('LMStudioAdapter.call against the participant response schemas', () => {
  it('spends its retries on a substantive reply with no claim, then fails as nonconforming rather than inventing one', async () => {
    modelFn.mockResolvedValue({ respond: respondFn })
    const returned = JSON.stringify({ outcome: 'commentary', note: 'the opening is late' })
    respondFn.mockResolvedValue({ nonReasoningContent: returned })

    const adapter = new LMStudioAdapter('ws://localhost:1234', assigned, silent)
    const result = await adapter.call('shape', 'prompt', eligibleResponseValueSchema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'nonconforming', returned })
    expect(respondFn).toHaveBeenCalledTimes(3)
  })

  it('refuses a no-comment reply from a participant that owes an answer', async () => {
    const returned = JSON.stringify({ outcome: 'noComment' })
    modelFn.mockResolvedValue({ respond: respondFn })
    respondFn.mockResolvedValue({ nonReasoningContent: returned })

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
