import { z } from 'zod'
import type { FailureReason } from '../../shared/modelResult.js'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'

export type { FailureReason } from '../../shared/modelResult.js'

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

/**
 * SPEC "Seams"/"Model access": the one seam every model call goes through, and
 * the only one — a call is made by naming the *site* that needs it, which is
 * the vocabulary the room speaks. Which model a site is assigned, whether one
 * is assigned at all, and the retry, timeout and residency policy around the
 * call are all owned by the implementation: none of them is a parameter here,
 * and no caller can observe them except as one of the stated outcomes.
 *
 * That is what makes the taxonomy whole at this interface. Every member of
 * `FailureReason` — `unconfigured` included — is something an implementation
 * of this type *returns*, so a substitute can state any of them and a test can
 * observe every one of them at the seam the product actually uses. Two
 * implementations satisfy this: `LMStudioAdapter` against the real runtime, and
 * `FixtureModelAdapter` in `tests/support/`, for tests only.
 */
export type ModelAccess = {
  call<T>(
    site: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>>

  status(): Promise<RuntimeStatus>
}
