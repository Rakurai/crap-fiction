import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { eligibleResponseValueSchema } from '../../../src/shared/participantResponse.js'
import { FixtureModelAdapter } from '../../support/modelAdapter.js'

const schema = z.object({ claim: z.string() })
const runtimeStatus = { reachable: true, models: [] } as const

describe('the fixture model implementation, as a substitute for the seam', () => {
  it('recovers a scripted value through the caller\'s own schema', async () => {
    const adapter = FixtureModelAdapter.uniform({ result: { outcome: 'value', value: { claim: 'the room agrees' } } }, runtimeStatus)

    const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'value', value: { claim: 'the room agrees' } })
  })

  it('reports a scripted value that does not conform as nonconforming, carrying what it was', async () => {
    const adapter = FixtureModelAdapter.uniform({ result: { outcome: 'value', value: { outcome: 'muttered' } } }, runtimeStatus)

    const result = await adapter.call('shape', 'prompt', eligibleResponseValueSchema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'nonconforming', returned: '{"outcome":"muttered"}' })
  })

  it('states each failure reason distinctly', async () => {
    for (const reason of ['unconfigured', 'unreachable', 'timeout', 'malformed', 'nonconforming'] as const) {
      const adapter = FixtureModelAdapter.uniform({ result: { outcome: 'failed', reason } }, runtimeStatus)

      const result = await adapter.call('shape', 'prompt', schema, new AbortController().signal)

      expect(result).toEqual({ outcome: 'failed', reason })
    }
  })

  it('resolves cancellation as abandoned rather than as a failure', async () => {
    const adapter = FixtureModelAdapter.uniform({ result: { outcome: 'value', value: { claim: 'too slow' } }, delayMs: 50 }, runtimeStatus)
    const controller = new AbortController()

    const pending = adapter.call('shape', 'prompt', schema, controller.signal)
    controller.abort()

    expect(await pending).toEqual({ outcome: 'abandoned' })
  })

  it('delivers scripted states, in order, ahead of the settled outcome', async () => {
    const adapter = FixtureModelAdapter.uniform(
      { result: { outcome: 'value', value: { claim: 'x' } }, states: ['preparing', 'working'] },
      runtimeStatus,
    )
    const states: string[] = []

    await adapter.call('shape', 'prompt', schema, new AbortController().signal, (state) => states.push(state))

    expect(states).toEqual(['preparing', 'working'])
  })

  it('keys a per-site script by the call site, and fails loudly on a site a test never scripted', async () => {
    const adapter = FixtureModelAdapter.bySite(
      { shape: { result: { outcome: 'value', value: { claim: 'from shape' } } } },
      runtimeStatus,
    )

    expect(await adapter.call('shape', 'prompt', schema, new AbortController().signal)).toEqual({
      outcome: 'value',
      value: { claim: 'from shape' },
    })
    await expect(adapter.call('story-editor', 'prompt', schema, new AbortController().signal)).rejects.toThrow(/no scripted result/)
  })

  it('controls each held job by its own site, settling them out of submission order with distinct outcomes', async () => {
    const adapter = FixtureModelAdapter.bySite(
      {
        shape: { result: { outcome: 'value', value: { claim: 'from shape' } }, held: true },
        compression: { result: { outcome: 'failed', reason: 'timeout' }, held: true },
      },
      runtimeStatus,
    )

    const first = adapter.call('shape', 'prompt', schema, new AbortController().signal)
    const second = adapter.call('compression', 'prompt', schema, new AbortController().signal)

    // Submitted first, settled last: nothing about submission order binds completion order.
    adapter.release('compression')
    expect(await second).toEqual({ outcome: 'failed', reason: 'timeout' })

    adapter.release('shape')
    expect(await first).toEqual({ outcome: 'value', value: { claim: 'from shape' } })
  })

  it('cancels one held job without disturbing another still open', async () => {
    const adapter = FixtureModelAdapter.bySite(
      {
        shape: { result: { outcome: 'value', value: { claim: 'from shape' } }, held: true },
        compression: { result: { outcome: 'value', value: { claim: 'from compression' } }, held: true },
      },
      runtimeStatus,
    )
    const cancelled = new AbortController()
    const untouched = new AbortController()

    const first = adapter.call('shape', 'prompt', schema, cancelled.signal)
    const second = adapter.call('compression', 'prompt', schema, untouched.signal)
    cancelled.abort()

    expect(await first).toEqual({ outcome: 'abandoned' })

    adapter.release('compression')
    expect(await second).toEqual({ outcome: 'value', value: { claim: 'from compression' } })
  })

  it('refuses to report a runtime status no test stated', async () => {
    const adapter = FixtureModelAdapter.uniform({ result: { outcome: 'abandoned' } }, undefined)

    await expect(adapter.status()).rejects.toThrow(/no runtime status scripted/)
  })

  it('reports the runtime status a test stated', async () => {
    const adapter = FixtureModelAdapter.uniform({ result: { outcome: 'abandoned' } }, { reachable: true, models: ['llama-3'] })

    expect(await adapter.status()).toEqual({ reachable: true, models: ['llama-3'] })
  })
})
