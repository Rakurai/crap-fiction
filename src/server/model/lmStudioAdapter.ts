import { LMStudioClient } from '@lmstudio/sdk'
import pRetry from 'p-retry'
import { z } from 'zod'
import type { StudioConfig } from '../../shared/config.js'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { Logger } from '../logger.js'
import type { ModelTraceRecord } from '../store/index.js'
import { APPLY_CALL_SITE } from './callSites.js'
import type { CallPrompt, CallResult, CallState, ModelAccess, ModelTrace } from './types.js'

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

class RuntimeCallError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'the model runtime did not answer', { cause })
    this.name = 'RuntimeCallError'
  }
}

async function throughRuntime<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw new RuntimeCallError(error)
  }
}

export class LMStudioAdapter implements ModelAccess {
  readonly #client: LMStudioClient
  readonly #getAssignment: GetAssignment
  readonly #config: StudioConfig['model']
  readonly #logger: Logger
  readonly #trace: ModelTrace | undefined
  #queue: Promise<unknown> = Promise.resolve()

  constructor(
    baseUrl: string,
    getAssignment: GetAssignment,
    config: StudioConfig['model'],
    logger: Logger,
    trace: ModelTrace | undefined,
  ) {
    this.#client = new LMStudioClient({ baseUrl: requireReachable(baseUrl) })
    this.#getAssignment = getAssignment
    this.#config = config
    this.#logger = logger
    this.#trace = trace
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
    prompt: CallPrompt,
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
    prompt: CallPrompt,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>> {
    if (signal.aborted) return this.#logged(site, undefined, { outcome: 'abandoned' })

    const assignment = this.#getAssignment(site)
    if (assignment === undefined) return this.#logged(site, undefined, { outcome: 'failed', reason: 'unconfigured' })

    const timeoutSignal = AbortSignal.timeout(this.#config.timeoutMs)
    const combined = AbortSignal.any([signal, timeoutSignal])
    const jsonSchema = z.toJSONSchema(schema)
    const maxTokens = site === APPLY_CALL_SITE ? this.#config.manuscriptMaxTokens : this.#config.responseMaxTokens

    let preparing = false
    const announce = (state: CallState): void => {
      if (state === 'preparing') {
        if (preparing) return
        preparing = true
      }
      onState?.(state)
    }

    try {
      const value = await pRetry((attempt) => this.#attempt(site, attempt, assignment, prompt, schema, jsonSchema, maxTokens, combined, announce), {
        retries: this.#config.retries,
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
      if (error instanceof RuntimeCallError) {
        this.#logger.error({ site, assignment, err: error.cause }, 'model runtime did not answer')
        return this.#logged(site, assignment, { outcome: 'failed', reason: 'unreachable' })
      }
      this.#logger.error({ site, assignment, err: error }, 'model call failed inside the studio')
      return this.#logged(site, assignment, { outcome: 'failed', reason: 'internal' })
    }
  }

  async #attempt<T>(
    site: string,
    attempt: number,
    assignment: string,
    prompt: CallPrompt,
    schema: z.ZodType<T>,
    jsonSchema: object,
    maxTokens: number,
    signal: AbortSignal,
    announce: (state: CallState) => void,
  ): Promise<T> {
    announce('preparing')
    const model = await throughRuntime(() => this.#client.llm.model(assignment, { signal }))
    announce('working')
    const result = await throughRuntime(() =>
      model.respond(`${prompt.durable}${prompt.perCall}`, { structured: { type: 'json', jsonSchema }, maxTokens, signal }),
    )

    const returned = result.nonReasoningContent

    const traced = async (reading: ModelTraceRecord['reading']): Promise<void> => {
      if (this.#trace === undefined) return
      await this.#trace({
        site,
        assignment,
        attempt,
        durablePrompt: prompt.durable,
        perCallPrompt: prompt.perCall,
        returned,
        reading,
        runtimeStopReason: result.stats.stopReason,
        promptTokens: result.stats.promptTokensCount,
        predictedTokens: result.stats.predictedTokensCount,
      })
    }

    let raw: unknown
    try {
      raw = JSON.parse(returned)
    } catch {
      await traced('malformed')
      throw new MalformedError(returned)
    }

    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      await traced('nonconforming')
      throw new NonConformingError(returned)
    }
    await traced('value')
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
