import { LMStudioClient } from '@lmstudio/sdk'
import pRetry from 'p-retry'
import { z } from 'zod'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { Logger } from '../logger.js'
import { APPLY_CALL_SITE } from './callSites.js'
import type { CallResult, CallState, ModelAccess } from './types.js'

const RETRIES = 2
const TIMEOUT_MS = 120_000

const RESPONSE_MAX_TOKENS = 2_000
const MANUSCRIPT_MAX_TOKENS = 32_000

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

class MalformedError extends Error {
  readonly returned: string

  constructor(returned: string) {
    super('response was not JSON')
    this.name = 'MalformedError'
    this.returned = returned
  }
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
  #queue: Promise<unknown> = Promise.resolve()

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

  call<T>(
    site: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    const run = this.#queue.then(() => this.#call(site, prompt, schema, signal, onState))
    this.#queue = run.catch(() => undefined)
    return run
  }

  async #call<T>(
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
    const maxTokens = site === APPLY_CALL_SITE ? MANUSCRIPT_MAX_TOKENS : RESPONSE_MAX_TOKENS

    let preparing = false
    const announce = (state: CallState): void => {
      if (state === 'preparing') {
        if (preparing) return
        preparing = true
      }
      onState?.(state)
    }

    try {
      const value = await pRetry(() => this.#attempt(assignment, prompt, schema, jsonSchema, maxTokens, combined, announce), {
        retries: RETRIES,
        signal: combined,
      })
      return this.#logged(site, assignment, { outcome: 'value', value })
    } catch (error) {
      if (signal.aborted) return this.#logged(site, assignment, { outcome: 'abandoned' })
      if (error instanceof MalformedError) {
        return this.#logged(site, assignment, { outcome: 'failed', reason: 'malformed', returned: error.returned })
      }
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
    maxTokens: number,
    signal: AbortSignal,
    announce: (state: CallState) => void,
  ): Promise<T> {
    announce('preparing')
    const model = await this.#client.llm.model(assignment, { signal })
    announce('working')
    const result = await model.respond(prompt, { structured: { type: 'json', jsonSchema }, maxTokens, signal })

    const returned = result.nonReasoningContent

    let raw: unknown
    try {
      raw = JSON.parse(returned)
    } catch {
      throw new MalformedError(returned)
    }

    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw new NonConformingError(returned)
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
