import { z } from 'zod'
import type { FailureReason } from '../../shared/modelResult.js'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'

export type { FailureReason } from '../../shared/modelResult.js'

export type CallResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'failed'; readonly reason: FailureReason; readonly returned?: string }

export type CallState = 'preparing' | 'working'

export type ModelAccess = {
  /**
   * Submits one call. A caller may submit further calls without awaiting this one, and the seam
   * promises nothing about the submissions relative to each other: not their start order, not
   * their completion order, not one's latency against another's, not that either reports
   * progress, and not that either cancels successfully. Each carries its own signal and its own
   * optional progress callback, and each settles independently.
   *
   * What an implementation owes its own runtime — serial execution, a capacity limit, model
   * residency — is that implementation's policy, not a caller's to coordinate.
   */
  call<T>(
    site: string,
    prompt: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>>

  status(): Promise<RuntimeStatus>
}
