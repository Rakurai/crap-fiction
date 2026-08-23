import type { z } from 'zod'
import type { RuntimeStatus } from '../../src/shared/runtimeStatus.js'
import type { CallResult, CallState, ModelAccess } from '../../src/server/model/types.js'

export type FixtureBehavior = Readonly<{
  result: CallResult<unknown>
  /** States delivered to `onState`, in order, before `result` settles. */
  states?: readonly CallState[]
  /** Simulated work, cancellable by the signal passed to `call`. */
  delayMs?: number
  /** Holds the call open until a test calls `release` for this site, rather than resolving on its own. */
  held?: boolean
}>

/**
 * SPEC "Test fixtures": a fixture implementation of the model seam, for tests
 * only. A test declares exactly what a call returns — a conforming value, an
 * abandonment, or any of the stated failures — either as one behavior every
 * site shares (`.uniform`), or as a map from call site to its own behavior for
 * a test that scripts sites individually (`.bySite`). There is no default
 * behaviour and no default runtime status: a fixture with nothing configured
 * has nothing to return, and a site absent from a per-site map is a test's own
 * failure to script it, reported as such rather than silently falling back to
 * some other site's behavior. A runtime status is scriptable as absent for the
 * same reason — a test that never says what the runtime reports must not be
 * handed a reachable one, so asking then fails loudly instead.
 *
 * A declared value is recovered through the caller's own schema, the same way
 * `LMStudioAdapter` recovers one, and a value that does not conform is
 * *reported* as `nonconforming` rather than thrown. That is what makes this a
 * substitute for the seam rather than an approximation of it: every member of
 * the failure taxonomy, including the one the real adapter derives from the
 * runtime's own output, is observable through this fixture. A fixture that threw
 * instead would leave the schema a caller selects unprotected, because no test
 * above it could ever see the outcome a wrong schema produces.
 *
 * This is the one adapter every scripted test goes through: a test that needs to
 * hold a call open until it releases it, and a test that needs to read the
 * prompt a site received, are the same seam used two ways rather than two
 * adapters.
 */
export class FixtureModelAdapter implements ModelAccess {
  readonly #behaviorFor: (site: string) => FixtureBehavior
  readonly #runtimeStatus: RuntimeStatus | undefined
  readonly #onCall: ((site: string) => void) | undefined
  readonly #prompts = new Map<string, string>()
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

  /** One behavior every call site shares. */
  static uniform(behavior: FixtureBehavior, runtimeStatus: RuntimeStatus | undefined): FixtureModelAdapter {
    return new FixtureModelAdapter(() => behavior, runtimeStatus, undefined)
  }

  /** A behavior scripted per call site; a call to one absent from `behaviors` is the test's own failure to script it. */
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
    prompt: string,
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

  /** Releases a call held open for `site`. May be called before the call ever reaches it. */
  release(site: string): void {
    this.#released.add(site)
    this.#gates.get(site)?.()
  }

  /** The prompt the named call site received, or `undefined` if it was never called. */
  promptFor(site: string): string | undefined {
    return this.#prompts.get(site)
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
