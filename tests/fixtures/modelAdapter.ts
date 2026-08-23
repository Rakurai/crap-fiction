import type { z } from 'zod'
import type { CallResult, CallState, ModelAdapter, RuntimeStatus } from '../../src/server/model/types.js'

export type FixtureBehavior = Readonly<{
  result: CallResult<unknown>
  /** States delivered to `onState`, in order, before `result` settles. */
  states?: readonly CallState[]
  /** Simulated work, cancellable by the signal passed to `invoke`. */
  delayMs?: number
}>

/**
 * SPEC "Test fixtures": a fixture implementation of the model interface,
 * for tests only. A test declares exactly what one call returns — a
 * conforming value, an abandonment, or any of the stated failures — and,
 * where the test needs it, a preparing state and a delay a real abort
 * signal can interrupt. There is no default behaviour and no default
 * runtime status: a fixture with nothing configured has nothing to return.
 *
 * A declared value is recovered through the caller's own schema at
 * `invoke`, the same way `LMStudioAdapter` recovers one, so no assertion
 * stands in for that seam here.
 */
export class FixtureModelAdapter implements ModelAdapter {
  readonly #behavior: FixtureBehavior
  readonly #runtimeStatus: RuntimeStatus

  constructor(behavior: FixtureBehavior, runtimeStatus: RuntimeStatus) {
    this.#behavior = behavior
    this.#runtimeStatus = runtimeStatus
  }

  async invoke<T>(
    _assignment: string,
    _prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    for (const state of this.#behavior.states ?? []) onState?.(state)

    if (this.#behavior.delayMs !== undefined) {
      await delay(this.#behavior.delayMs, signal)
    }

    if (signal.aborted) return { outcome: 'abandoned' }

    const result = this.#behavior.result
    if (result.outcome !== 'value') return result
    return { outcome: 'value', value: schema.parse(result.value) }
  }

  async status(): Promise<RuntimeStatus> {
    return this.#runtimeStatus
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
