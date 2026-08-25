import type { z } from 'zod'
import type { RuntimeStatus } from '../../src/shared/runtimeStatus.js'
import type { CallPrompt, CallResult, CallState, ModelAccess } from '../../src/server/model/types.js'

export type FixtureBehavior = Readonly<{
  result: CallResult<unknown>
  states?: readonly CallState[]
  delayMs?: number
  held?: boolean
}>

export class FixtureModelAdapter implements ModelAccess {
  readonly #behaviorFor: (site: string) => FixtureBehavior
  readonly #runtimeStatus: RuntimeStatus | undefined
  readonly #onCall: ((site: string) => void) | undefined
  readonly #prompts = new Map<string, CallPrompt>()
  readonly #released = new Set<string>()
  readonly #gates = new Map<string, () => void>()

  private constructor(
    behaviorFor: (site: string) => FixtureBehavior,
    runtimeStatus: RuntimeStatus | undefined,
    onCall: ((site: string) => void) | undefined,
  ) {
    this.#behaviorFor = behaviorFor
    this.#runtimeStatus = runtimeStatus
    this.#onCall = onCall
  }

  static uniform(behavior: FixtureBehavior, runtimeStatus: RuntimeStatus | undefined): FixtureModelAdapter {
    return new FixtureModelAdapter(() => behavior, runtimeStatus, undefined)
  }

  static bySite(
    behaviors: Readonly<Record<string, FixtureBehavior>>,
    runtimeStatus: RuntimeStatus | undefined,
    onCall?: (site: string) => void,
  ): FixtureModelAdapter {
    return new FixtureModelAdapter(
      (site) => {
        const behavior = behaviors[site]
        if (behavior === undefined) throw new Error(`no scripted result for "${site}"`)
        return behavior
      },
      runtimeStatus,
      onCall,
    )
  }

  async call<T>(
    site: string,
    prompt: CallPrompt,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    this.#prompts.set(site, prompt)
    this.#onCall?.(site)
    if (signal.aborted) return { outcome: 'abandoned' }

    const behavior = this.#behaviorFor(site)
    for (const state of behavior.states ?? []) onState?.(state)

    if (behavior.held) {
      await this.#awaitRelease(site, signal)
    } else if (behavior.delayMs !== undefined) {
      await delay(behavior.delayMs, signal)
    }

    if (signal.aborted) return { outcome: 'abandoned' }

    const result = behavior.result
    if (result.outcome !== 'value') return result as CallResult<T>

    const parsed = schema.safeParse(result.value)
    if (!parsed.success) {
      return { outcome: 'failed', reason: 'nonconforming', returned: JSON.stringify(result.value) }
    }
    return { outcome: 'value', value: parsed.data }
  }

  release(site: string): void {
    this.#released.add(site)
    this.#gates.get(site)?.()
  }

  promptFor(site: string): string | undefined {
    const prompt = this.#prompts.get(site)
    return prompt === undefined ? undefined : prompt.durable + prompt.perCall
  }

  async status(): Promise<RuntimeStatus> {
    const status = this.#runtimeStatus
    if (status === undefined) throw new Error('no runtime status scripted for this fixture adapter')
    return status
  }

  #awaitRelease(site: string, signal: AbortSignal): Promise<void> {
    if (this.#released.has(site)) return Promise.resolve()
    return new Promise((resolve) => {
      this.#gates.set(site, resolve)
      signal.addEventListener('abort', () => resolve(), { once: true })
    })
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}
