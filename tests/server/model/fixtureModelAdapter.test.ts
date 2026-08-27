import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { eligibleResponseValueSchema } from '../../../src/shared/participantResponse.js'
import { FixtureModelAdapter } from '../../support/modelAdapter.js'

const schema = z.object({ claim: z.string() })
const runtimeStatus = { reachable: true, models: [] } as const
const prompt = { durable: 'durable', perCall: 'per-call' }

describe('the fixture model implementation, as a substitute for the seam', () => {
  it("relays every scripted outcome as the seam would — a value through the caller's own schema, one that does not conform as nonconforming carrying what it was, and a failure as its own reason", async () => {
    const conforming = FixtureModelAdapter.uniform({ result: { outcome: 'value', value: { claim: 'the room agrees' } } }, runtimeStatus)
    expect(await conforming.call('shape', prompt, schema, new AbortController().signal)).toEqual({
      outcome: 'value',
      value: { claim: 'the room agrees' },
    })

    const muttering = FixtureModelAdapter.uniform({ result: { outcome: 'value', value: { outcome: 'muttered' } } }, runtimeStatus)
    expect(await muttering.call('shape', prompt, eligibleResponseValueSchema, new AbortController().signal)).toEqual({
      outcome: 'failed',
      reason: 'nonconforming',
      returned: '{"outcome":"muttered"}',
    })

    const failing = FixtureModelAdapter.uniform({ result: { outcome: 'failed', reason: 'timeout' } }, runtimeStatus)
    expect(await failing.call('shape', prompt, schema, new AbortController().signal)).toEqual({ outcome: 'failed', reason: 'timeout' })
  })

  it('delivers scripted states in order ahead of the settled outcome, and resolves cancellation as abandoned rather than as a failure', async () => {
    const adapter = FixtureModelAdapter.uniform(
      { result: { outcome: 'value', value: { claim: 'x' } }, states: ['preparing', 'working'] },
      runtimeStatus,
    )
    const states: string[] = []

    await adapter.call('shape', prompt, schema, new AbortController().signal, (state) => states.push(state))

    expect(states).toEqual(['preparing', 'working'])

    const slow = FixtureModelAdapter.uniform({ result: { outcome: 'value', value: { claim: 'too slow' } }, delayMs: 50 }, runtimeStatus)
    const controller = new AbortController()
    const pending = slow.call('shape', prompt, schema, controller.signal)
    controller.abort()

    expect(await pending).toEqual({ outcome: 'abandoned' })
  })

  it('keys a per-site script by the call site, and fails loudly on a site a test never scripted', async () => {
    const adapter = FixtureModelAdapter.bySite(
      { shape: { result: { outcome: 'value', value: { claim: 'from shape' } } } },
      runtimeStatus,
    )

    expect(await adapter.call('shape', prompt, schema, new AbortController().signal)).toEqual({
      outcome: 'value',
      value: { claim: 'from shape' },
    })
    await expect(adapter.call('story-editor', prompt, schema, new AbortController().signal)).rejects.toThrow(/no scripted result/)
  })

  it('reports the runtime status a test stated, and refuses to invent one no test stated', async () => {
    const stated = FixtureModelAdapter.uniform({ result: { outcome: 'abandoned' } }, { reachable: true, models: ['llama-3'] })
    expect(await stated.status()).toEqual({ reachable: true, models: ['llama-3'] })

    const unstated = FixtureModelAdapter.uniform({ result: { outcome: 'abandoned' } }, undefined)
    await expect(unstated.status()).rejects.toThrow(/no runtime status scripted/)
  })
})
