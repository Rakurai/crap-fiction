import { LMStudioClient } from '@lmstudio/sdk'
import pRetry from 'p-retry'
import { z } from 'zod'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { Logger } from '../logger.js'
import type { CallResult, CallState, ModelAccess } from './types.js'

const RETRIES = 2
const TIMEOUT_MS = 120_000

export type GetAssignment = (site: string) => string | undefined

export class ModelRuntimeUrlError extends Error {
  constructor(value: string, reason: string) {
    super(`STUDIO_MODEL_RUNTIME_URL cannot be reached: ${reason} (the value was "${value}")`)
    this.name = 'ModelRuntimeUrlError'
  }
}

const REACHABLE_SCHEMES = ['ws:', 'wss:']

function requireReachable(baseUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new ModelRuntimeUrlError(baseUrl, 'it is not a URL')
  }

  if (!REACHABLE_SCHEMES.includes(parsed.protocol)) {
    const scheme = parsed.protocol.replace(':', '')
    throw new ModelRuntimeUrlError(
      baseUrl,
      `the runtime is reached over a WebSocket, so the scheme must be ws or wss, not ${scheme} — the port LM Studio's interface shows is right, the scheme is not`,
    )
  }

  return baseUrl
}

class NonConformingError extends Error {
  readonly returned: string

  constructor(returned: string) {
    super('response did not conform to the schema')
    this.name = 'NonConformingError'
    this.returned = returned
  }
}

export class LMStudioAdapter implements ModelAccess {
  readonly #client: LMStudioClient
  readonly #getAssignment: GetAssignment
  readonly #logger: Logger

  constructor(baseUrl: string, getAssignment: GetAssignment, logger: Logger) {
    this.#client = new LMStudioClient({ baseUrl: requireReachable(baseUrl) })
    this.#getAssignment = getAssignment
    this.#logger = logger
  }

  #logged<T>(site: string, assignment: string | undefined, result: CallResult<T>): CallResult<T> {
    this.#logger.info(
      {
        site,
        assignment,
        outcome: result.outcome,
        reason: result.outcome === 'failed' ? result.reason : undefined,
      },
      'model call',
    )
    return result
  }

  async call<T>(
    site: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    if (signal.aborted) return this.#logged(site, undefined, { outcome: 'abandoned' })

    const assignment = this.#getAssignment(site)
    if (assignment === undefined) return this.#logged(site, undefined, { outcome: 'failed', reason: 'unconfigured' })

    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS)
    const combined = AbortSignal.any([signal, timeoutSignal])
    const jsonSchema = z.toJSONSchema(schema)

    try {
      const value = await pRetry(() => this.#attempt(assignment, prompt, schema, jsonSchema, combined, onState), {
        retries: RETRIES,
        signal: combined,
      })
      return this.#logged(site, assignment, { outcome: 'value', value })
    } catch (error) {
      if (signal.aborted) return this.#logged(site, assignment, { outcome: 'abandoned' })
      if (error instanceof NonConformingError) {
        return this.#logged(site, assignment, { outcome: 'failed', reason: 'nonconforming', returned: error.returned })
      }
      if (timeoutSignal.aborted) return this.#logged(site, assignment, { outcome: 'failed', reason: 'timeout' })
      return this.#logged(site, assignment, { outcome: 'failed', reason: 'unreachable' })
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
    } catch (err) {
      this.#logger.warn({ err }, 'model runtime unreachable')
      return { reachable: false }
    }
  }
}
