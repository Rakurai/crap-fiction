import type { z } from 'zod'
import type { RuntimeStatus } from '../../src/shared/runtimeStatus.js'
import type { CallResult, CallState, CallTurns, ModelAccess } from '../../src/server/model/types.js'

export type FixtureBehavior = Readonly<{
  result: CallResult<unknown>
  states?: readonly CallState[]
  delayMs?: number
  held?: boolean
}>

export type FixtureScript = FixtureBehavior | readonly FixtureBehavior[]

export class FixtureModelAdapter implements ModelAccess {
  readonly #scriptFor: (site: string) => FixtureScript
  readonly #runtimeStatus: RuntimeStatus | undefined
  readonly #onCall: ((site: string) => void) | undefined
  readonly #calls: Array<{ site: string; turns: CallTurns }> = []
  readonly #released = new Set<string>()
  readonly #gates = new Map<string, () => void>()

  private constructor(
    scriptFor: (site: string) => FixtureScript,
    runtimeStatus: RuntimeStatus | undefined,
    onCall: ((site: string) => void) | undefined,
  ) {
    this.#scriptFor = scriptFor
    this.#runtimeStatus = runtimeStatus
    this.#onCall = onCall
  }

  static uniform(behavior: FixtureBehavior, runtimeStatus: RuntimeStatus | undefined): FixtureModelAdapter {
    return new FixtureModelAdapter(() => behavior, runtimeStatus, undefined)
  }

  static bySite(
    scripts: Readonly<Record<string, FixtureScript>>,
    runtimeStatus: RuntimeStatus | undefined,
    onCall?: (site: string) => void,
  ): FixtureModelAdapter {
    return new FixtureModelAdapter(
      (site) => {
        const script = scripts[site]
        if (script === undefined) throw new Error(`no scripted result for "${site}"`)
        return script
      },
      runtimeStatus,
      onCall,
    )
  }

  async call<T>(
    site: string,
    turns: CallTurns,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    const round = this.turnsFor(site).length
    this.#calls.push({ site, turns })
    this.#onCall?.(site)
    if (signal.aborted) return { outcome: 'abandoned' }

    const behavior = this.#behaviorFor(site, round)
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

  turnsFor(site: string): readonly CallTurns[] {
    return this.#calls.filter((call) => call.site === site).map((call) => call.turns)
  }

  promptFor(site: string): string | undefined {
    const rounds = this.turnsFor(site)
    const last = rounds[rounds.length - 1]
    return last === undefined ? undefined : last.map((turn) => turn.content).join('')
  }

  #behaviorFor(site: string, round: number): FixtureBehavior {
    const script = this.#scriptFor(site)
    if ('result' in script) return script
    const behavior = script[round]
    if (behavior === undefined) throw new Error(`no scripted result for "${site}" beyond ${script.length} call(s)`)
    return behavior
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
