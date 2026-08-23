import type { z } from 'zod'

/**
 * SPEC "Model access": the failure taxonomy is the product's own — no status
 * code, runtime error class or SDK exception type crosses this boundary.
 */
export type FailureReason = 'unconfigured' | 'unreachable' | 'timeout' | 'nonconforming'

export type CallResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'failed'; readonly reason: FailureReason; readonly returned?: string }

/**
 * SPEC "Model access": a call may report that it is preparing (a model being
 * loaded) before it is working, and an implementation that cannot tell the
 * two apart simply never reports preparing.
 */
export type CallState = 'preparing' | 'working'

export type RuntimeStatus =
  | { readonly reachable: true; readonly models: readonly string[] }
  | { readonly reachable: false }

/**
 * SPEC "Seams"/"Model access": the seam every model call goes through. An
 * assignment names a model; its shape is opaque above this interface, and an
 * implementation owns its own retry, timeout and residency policy — none of
 * that is a parameter here. Two adapters satisfy this: `LMStudioAdapter`
 * against the real runtime, and `FixtureModelAdapter` in `tests/fixtures`,
 * for tests only.
 */
export type ModelAdapter = {
  invoke<T>(
    assignment: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>>

  status(): Promise<RuntimeStatus>
}
