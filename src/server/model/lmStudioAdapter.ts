import { LMStudioClient } from '@lmstudio/sdk'
import pRetry from 'p-retry'
import { z } from 'zod'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { Logger } from '../logger.js'
import type { CallResult, CallState, ModelAccess } from './types.js'

const RETRIES = 2
const TIMEOUT_MS = 120_000

/** Which model a call site is assigned, or `undefined` where the author has assigned none. */
export type GetAssignment = (site: string) => string | undefined

/**
 * SPEC "Deployment": an absent or malformed `STUDIO_MODEL_RUNTIME_URL` is a
 * startup failure naming it. Which values are malformed is this module's fact
 * and not `env.ts`'s — the variable is described as where the model module
 * reaches the runtime precisely so the shape stays opaque above this seam
 * (CODING_STANDARDS "Contain vendor concepts in the module that owns the
 * vendor") — so the check lives here and states the failure in the product's
 * own words rather than letting a vendor stack trace be what the author reads.
 */
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

/**
 * SPEC "Model access": `@lmstudio/sdk` used natively and fully, never
 * wrapped in a provider abstraction. It owns loading, holding and evicting
 * models — residency is the SDK's `llm.model()`, which loads only what is
 * not already resident — and this adapter owns retry and timeout on top of
 * it, since those are policy owned by the module that knows the reliability
 * of the runtime it calls. Reasoning never crosses out of this file: only
 * `result.content`, parsed against the caller's schema, ever leaves
 * `#attempt`.
 *
 * Assignment lookup is this adapter's own business for the same reason: a site
 * with no assignment fails as unconfigured without the runtime ever being
 * contacted, and nothing here falls back to another model. An assignment's
 * shape is therefore never named above this file.
 */
export class LMStudioAdapter implements ModelAccess {
  readonly #client: LMStudioClient
  readonly #getAssignment: GetAssignment
  readonly #logger: Logger

  constructor(baseUrl: string, getAssignment: GetAssignment, logger: Logger) {
    this.#client = new LMStudioClient({ baseUrl: requireReachable(baseUrl) })
    this.#getAssignment = getAssignment
    this.#logger = logger
  }

  /**
   * One line per call, at the seam that owns the call: which site asked, which
   * model it was assigned, and how it ended. Never the prompt and never what came
   * back (CODING_STANDARDS "Logging") — those are the material the studio exists
   * to handle, and a log line is where they would become a durable record nobody
   * decided to keep. Every return path goes through here so there is exactly one
   * such line and no path that quietly has none.
   */
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
      // The one place the runtime's absence is discovered, so the one place it is
      // recorded: the author is shown `reachable: false` and nothing more, and
      // whatever the SDK threw is a diagnostic fact that belongs on stderr.
      this.#logger.warn({ err }, 'model runtime unreachable')
      return { reachable: false }
    }
  }
}
