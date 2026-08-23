import { LMStudioClient } from '@lmstudio/sdk'
import pRetry from 'p-retry'
import { z } from 'zod'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { CallResult, CallState, ModelAdapter } from './types.js'

const RETRIES = 2
const TIMEOUT_MS = 120_000

class NonConformingError extends Error {
  readonly returned: string

  constructor(returned: string) {
    super('response did not conform to the schema')
    this.name = 'NonConformingError'
    this.returned = returned
  }
}

/**
 * SPEC "Model access": `@lmstudio/sdk` used natively and fully, never
 * wrapped in a provider abstraction. It owns loading, holding and evicting
 * models — residency is the SDK's `llm.model()`, which loads only what is
 * not already resident — and this adapter owns retry and timeout on top of
 * it, since those are policy owned by the module that knows the reliability
 * of the runtime it calls. Reasoning never crosses out of this file: only
 * `result.content`, parsed against the caller's schema, ever leaves
 * `#attempt`.
 */
export class LMStudioAdapter implements ModelAdapter {
  readonly #client: LMStudioClient

  constructor(baseUrl: string) {
    this.#client = new LMStudioClient({ baseUrl })
  }

  async invoke<T>(
    assignment: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    if (signal.aborted) return { outcome: 'abandoned' }

    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS)
    const combined = AbortSignal.any([signal, timeoutSignal])
    const jsonSchema = z.toJSONSchema(schema)

    try {
      const value = await pRetry(() => this.#attempt(assignment, prompt, schema, jsonSchema, combined, onState), {
        retries: RETRIES,
        signal: combined,
      })
      return { outcome: 'value', value }
    } catch (error) {
      if (signal.aborted) return { outcome: 'abandoned' }
      if (error instanceof NonConformingError) {
        return { outcome: 'failed', reason: 'nonconforming', returned: error.returned }
      }
      if (timeoutSignal.aborted) return { outcome: 'failed', reason: 'timeout' }
      return { outcome: 'failed', reason: 'unreachable' }
    }
  }

  async #attempt<T>(
    assignment: string,
    prompt: string,
    schema: z.ZodType<T>,
    jsonSchema: object,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<T> {
    onState?.('preparing')
    const model = await this.#client.llm.model(assignment, { signal })
    onState?.('working')
    const result = await model.complete(prompt, { structured: { type: 'json', jsonSchema }, signal })

    let raw: unknown
    try {
      raw = JSON.parse(result.content)
    } catch {
      throw new NonConformingError(result.content)
    }

    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw new NonConformingError(result.content)
    }
    return parsed.data
  }

  async status(): Promise<RuntimeStatus> {
    try {
      const models = await this.#client.system.listDownloadedModels('llm')
      return { reachable: true, models: models.map((model) => model.modelKey) }
    } catch {
      return { reachable: false }
    }
  }
}
