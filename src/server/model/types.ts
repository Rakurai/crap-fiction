import { z } from 'zod'
import { participantStageSchema } from '../../shared/conversationEvents.js'
import type { FailureReason } from '../../shared/modelResult.js'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'
import type { ModelTraceRecord } from '../store/index.js'

export type { FailureReason } from '../../shared/modelResult.js'

export type CallResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'failed'; readonly reason: FailureReason; readonly returned?: string }

export const callStateSchema = participantStageSchema.exclude(['called'])

export type CallState = z.infer<typeof callStateSchema>

export type CallPrompt = Readonly<{ durable: string; perCall: string }>

export type ModelTrace = (record: ModelTraceRecord) => Promise<void>

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
