import type { z } from 'zod'
import type { CallResult, CallState, ModelAdapter, RuntimeStatus } from './types.js'

export type GetAssignment = (site: string) => string | undefined

/**
 * SPEC "Model access": the one narrow interface every model call goes
 * through. Assignment lookup is this module's own business — a call site
 * with no assignment fails as unconfigured without the adapter, and thus
 * the runtime, ever being contacted, and nothing here falls back to another
 * model. Retry, timeout and residency are policy owned by the adapter, which
 * knows the reliability of the thing it calls; this composition knows
 * neither.
 */
export class ModelAccess {
  readonly #adapter: ModelAdapter
  readonly #getAssignment: GetAssignment

  constructor(adapter: ModelAdapter, getAssignment: GetAssignment) {
    this.#adapter = adapter
    this.#getAssignment = getAssignment
  }

  async call<T>(
    site: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    const assignment = this.#getAssignment(site)
    if (assignment === undefined) {
      return { outcome: 'failed', reason: 'unconfigured' }
    }
    return this.#adapter.invoke(assignment, prompt, schema, signal, onState)
  }

  status(): Promise<RuntimeStatus> {
    return this.#adapter.status()
  }
}
