import { z } from 'zod'
import type { FailureReason } from '../../shared/modelResult.js'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'

export type { FailureReason } from '../../shared/modelResult.js'

export type CallResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'failed'; readonly reason: FailureReason; readonly returned?: string }

export type CallState = 'preparing' | 'working'

/** What is true of the call site before a request, and the task and material a particular request carries. */
export type CallPrompt = Readonly<{ durable: string; perCall: string }>

export type ModelAccess = {
  call<T>(
    site: string,
    prompt: CallPrompt,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>>

  status(): Promise<RuntimeStatus>
}
