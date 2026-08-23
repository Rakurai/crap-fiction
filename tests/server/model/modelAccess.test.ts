import { describe, expect, it } from 'vitest'
import { FixtureModelAdapter } from '../../../src/server/model/fixtureAdapter.js'
import { ModelAccess } from '../../../src/server/model/modelAccess.js'
import { z } from 'zod'

const schema = z.object({ claim: z.string() })

describe('ModelAccess.call', () => {
  it('fails as unconfigured without contacting the adapter when a call site has no assignment', async () => {
    const adapter = new FixtureModelAdapter({ result: { outcome: 'value', value: { claim: 'x' } } })
    const access = new ModelAccess(adapter, () => undefined)

    const result = await access.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(adapter.invocations).toBe(0)
  })

  it('never falls back to another assignment: an unconfigured site fails even when others are assigned', async () => {
    const adapter = new FixtureModelAdapter({ result: { outcome: 'value', value: { claim: 'x' } } })
    const access = new ModelAccess(adapter, (site) => (site === 'story-editor' ? 'qwen-14b' : undefined))

    const result = await access.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'failed', reason: 'unconfigured' })
    expect(adapter.invocations).toBe(0)
  })

  it('passes through a conforming value from the adapter', async () => {
    const adapter = new FixtureModelAdapter({ result: { outcome: 'value', value: { claim: 'the room agrees' } } })
    const access = new ModelAccess(adapter, () => 'llama-3')

    const result = await access.call('shape', 'prompt', schema, new AbortController().signal)

    expect(result).toEqual({ outcome: 'value', value: { claim: 'the room agrees' } })
  })

  it('passes through each stated failure reason distinctly', async () => {
    for (const reason of ['unreachable', 'timeout', 'nonconforming'] as const) {
      const adapter = new FixtureModelAdapter({ result: { outcome: 'failed', reason, returned: 'garbage' } })
      const access = new ModelAccess(adapter, () => 'llama-3')

      const result = await access.call('shape', 'prompt', schema, new AbortController().signal)

      expect(result).toEqual({ outcome: 'failed', reason, returned: 'garbage' })
    }
  })

  it('resolves cancellation as abandoned rather than as a failure', async () => {
    const adapter = new FixtureModelAdapter({ result: { outcome: 'value', value: { claim: 'too slow' } }, delayMs: 50 })
    const access = new ModelAccess(adapter, () => 'llama-3')
    const controller = new AbortController()

    const pending = access.call('shape', 'prompt', schema, controller.signal)
    controller.abort()

    expect(await pending).toEqual({ outcome: 'abandoned' })
  })

  it('reports preparing before working, in order, ahead of the settled outcome', async () => {
    const adapter = new FixtureModelAdapter({ result: { outcome: 'value', value: { claim: 'x' } }, states: ['preparing', 'working'] })
    const access = new ModelAccess(adapter, () => 'llama-3')
    const states: string[] = []

    await access.call('shape', 'prompt', schema, new AbortController().signal, (state) => states.push(state))

    expect(states).toEqual(['preparing', 'working'])
  })
})

describe('ModelAccess.status', () => {
  it('reports the runtime unreachable rather than throwing', async () => {
    const adapter = new FixtureModelAdapter({ result: { outcome: 'abandoned' } }, { reachable: false })
    const access = new ModelAccess(adapter, () => undefined)

    expect(await access.status()).toEqual({ reachable: false })
  })

  it('reports what the runtime holds when it is reachable', async () => {
    const adapter = new FixtureModelAdapter({ result: { outcome: 'abandoned' } }, { reachable: true, models: ['llama-3'] })
    const access = new ModelAccess(adapter, () => undefined)

    expect(await access.status()).toEqual({ reachable: true, models: ['llama-3'] })
  })
})
