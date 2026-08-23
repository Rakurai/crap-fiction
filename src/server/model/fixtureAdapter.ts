import type { z } from 'zod'
import type { CallResult, CallState, ModelAdapter, RuntimeStatus } from './types.js'

export type FixtureBehavior<T> = Readonly<{
  result: CallResult<T>
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
 * signal can interrupt. There is no default behaviour: a fixture with
 * nothing configured has nothing to return, which is the point.
 *
 * The configured behaviour is fixed at construction, for the one value type
 * the test needing it cares about; the cast to the seam's own per-call
 * generic is this fixture's business alone, since a schema is never
 * actually enforced here the way `LMStudioAdapter` enforces one.
 */
export class FixtureModelAdapter<TValue = unknown> implements ModelAdapter {
  readonly #behavior: FixtureBehavior<TValue>
  readonly #runtimeStatus: RuntimeStatus
  invocations = 0

  constructor(behavior: FixtureBehavior<TValue>, runtimeStatus: RuntimeStatus = { reachable: true, models: [] }) {
    this.#behavior = behavior
    this.#runtimeStatus = runtimeStatus
  }

  async invoke<T>(
    _assignment: string,
    _prompt: string,
    _schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    this.invocations += 1
    for (const state of this.#behavior.states ?? []) onState?.(state)

    if (this.#behavior.delayMs !== undefined) {
      await delay(this.#behavior.delayMs, signal)
    }

    if (signal.aborted) return { outcome: 'abandoned' }
    return this.#behavior.result as unknown as CallResult<T>
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
