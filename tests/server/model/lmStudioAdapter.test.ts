import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const { modelFn, completeFn } = vi.hoisted(() => ({
  modelFn: vi.fn(),
  completeFn: vi.fn(),
}))

vi.mock('@lmstudio/sdk', () => ({
  LMStudioClient: class {
    llm = { model: modelFn }
    system = { listDownloadedModels: vi.fn() }
  },
}))

const { LMStudioAdapter } = await import('../../../src/server/model/lmStudioAdapter.js')

const schema = z.object({ claim: z.string() })

beforeEach(() => {
  modelFn.mockReset()
  completeFn.mockReset()
})

describe('LMStudioAdapter.invoke', () => {
  it('re-issues a nonconforming response under its own retry policy and returns the value once it conforms', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn
      .mockResolvedValueOnce({ content: 'not json' })
      .mockResolvedValueOnce({ content: JSON.stringify({ claim: 'the room agrees' }) })

    const adapter = new LMStudioAdapter('http://localhost:1234')
    const result = await adapter.invoke('llama-3', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'value', value: { claim: 'the room agrees' } })
    expect(completeFn).toHaveBeenCalledTimes(2)
  })

  it('fails as nonconforming, carrying verbatim what came back, once the retry policy is exhausted', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn.mockResolvedValue({ content: 'still not json' })

    const adapter = new LMStudioAdapter('http://localhost:1234')
    const result = await adapter.invoke('llama-3', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'nonconforming', returned: 'still not json' })
    expect(completeFn).toHaveBeenCalledTimes(3) // one attempt plus two retries
  })

  it('returns an ordinary value with no record of having taken more than one attempt', async () => {
    modelFn.mockResolvedValue({ complete: completeFn })
    completeFn
      .mockResolvedValueOnce({ content: 'garbage' })
      .mockResolvedValueOnce({ content: JSON.stringify({ claim: 'second try' }) })

    const adapter = new LMStudioAdapter('http://localhost:1234')
    const result = await adapter.invoke('llama-3', 'prompt', schema, new AbortController().signal)

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

    const adapter = new LMStudioAdapter('http://localhost:1234')
    const pending = adapter.invoke('llama-3', 'prompt', schema, controller.signal)
    controller.abort()

    expect(await pending).toEqual({ outcome: 'abandoned' })
    expect(completeFn).not.toHaveBeenCalled()
  })
})
