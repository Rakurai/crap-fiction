import type { z } from 'zod'
import type { RuntimeStatus } from '../../src/shared/runtimeStatus.js'
import type { CallResult, CallState, ModelAdapter } from '../../src/server/model/types.js'

export type FixtureBehavior = Readonly<{
  result: CallResult<unknown>
  /** States delivered to `onState`, in order, before `result` settles. */
  states?: readonly CallState[]
  /** Simulated work, cancellable by the signal passed to `invoke`. */
  delayMs?: number
  /** Holds the call open until a test calls `release` for this assignment, rather than resolving on its own. */
  held?: boolean
}>

/**
 * SPEC "Test fixtures": a fixture implementation of the model interface, for
 * tests only. A test declares exactly what a call returns — a conforming
 * value, an abandonment, or any of the stated failures — either as one
 * behavior every assignment shares (`.uniform`), or as a map from
 * assignment to its own behavior for a test that scripts sites individually
 * (`.bySite`). There is no default behaviour and no default runtime status:
 * a fixture with nothing configured has nothing to return, and an
 * assignment absent from a per-site map is a test's own failure to script
 * it, reported as such rather than silently falling back to some other
 * site's behavior.
 *
 * A declared value is recovered through the caller's own schema at `invoke`,
 * the same way `LMStudioAdapter` recovers one, so no assertion stands in for
 * that seam here. This is the one adapter every scripted test goes through:
 * a test that needs to hold a call open until it releases it, and a test
 * that needs to read the prompt a site received, are the same seam used two
 * ways rather than two adapters.
 */
export class FixtureModelAdapter implements ModelAdapter {
  readonly #behaviorFor: (assignment: string) => FixtureBehavior
  readonly #runtimeStatus: RuntimeStatus
  readonly #onInvoke: ((assignment: string) => void) | undefined
  readonly #prompts = new Map<string, string>()
  readonly #released = new Set<string>()
  readonly #gates = new Map<string, () => void>()

  private constructor(
    behaviorFor: (assignment: string) => FixtureBehavior,
    runtimeStatus: RuntimeStatus,
    onInvoke: ((assignment: string) => void) | undefined,
  ) {
    this.#behaviorFor = behaviorFor
    this.#runtimeStatus = runtimeStatus
    this.#onInvoke = onInvoke
  }

  /** One behavior every assignment shares. */
  static uniform(behavior: FixtureBehavior, runtimeStatus: RuntimeStatus): FixtureModelAdapter {
    return new FixtureModelAdapter(() => behavior, runtimeStatus, undefined)
  }

  /** A behavior scripted per assignment; a call to one absent from `behaviors` is the test's own failure to script it. */
  static bySite(
    behaviors: Readonly<Record<string, FixtureBehavior>>,
    runtimeStatus: RuntimeStatus,
    onInvoke?: (assignment: string) => void,
  ): FixtureModelAdapter {
    return new FixtureModelAdapter(
      (assignment) => {
        const behavior = behaviors[assignment]
        if (behavior === undefined) throw new Error(`no scripted result for "${assignment}"`)
        return behavior
      },
      runtimeStatus,
      onInvoke,
    )
  }

  async invoke<T>(
    assignment: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    this.#prompts.set(assignment, prompt)
    this.#onInvoke?.(assignment)
    if (signal.aborted) return { outcome: 'abandoned' }

    const behavior = this.#behaviorFor(assignment)
    for (const state of behavior.states ?? []) onState?.(state)

    if (behavior.held) {
      await this.#awaitRelease(assignment, signal)
    } else if (behavior.delayMs !== undefined) {
      await delay(behavior.delayMs, signal)
    }

    if (signal.aborted) return { outcome: 'abandoned' }

    const result = behavior.result
    if (result.outcome !== 'value') return result as CallResult<T>
    return { outcome: 'value', value: schema.parse(result.value) }
  }

  /** Releases a call held open for `assignment`. May be called before the call ever reaches it. */
  release(assignment: string): void {
    this.#released.add(assignment)
    this.#gates.get(assignment)?.()
  }

  /** The prompt the named assignment received, or `undefined` if it was never called. */
  promptFor(assignment: string): string | undefined {
    return this.#prompts.get(assignment)
  }

  async status(): Promise<RuntimeStatus> {
    return this.#runtimeStatus
  }

  #awaitRelease(assignment: string, signal: AbortSignal): Promise<void> {
    if (this.#released.has(assignment)) return Promise.resolve()
    return new Promise((resolve) => {
      this.#gates.set(assignment, resolve)
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
