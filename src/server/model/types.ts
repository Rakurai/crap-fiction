import { z } from 'zod'
import { participantStageSchema } from '../../shared/conversationEvents.js'
import type { FailureReason } from '../../shared/modelResult.js'
import type { RuntimeStatus } from '../../shared/runtimeStatus.js'

export type { FailureReason } from '../../shared/modelResult.js'

export type CallResult<T> =
  | { readonly outcome: 'value'; readonly value: T }
  | { readonly outcome: 'abandoned' }
  | { readonly outcome: 'failed'; readonly reason: FailureReason; readonly returned?: string }

export const callStateSchema = participantStageSchema.exclude(['called'])

export type CallState = z.infer<typeof callStateSchema>

export type TurnRole = 'system' | 'user' | 'assistant'

export type Turn = Readonly<{ role: TurnRole; content: string }>

export type CallTurns = readonly Turn[]

export type ModelTraceRecord = Readonly<{
  site: string
  assignment: string
  attempt: number
  turns: CallTurns
  returned: string
  reading: 'value' | 'malformed' | 'nonconforming'
  runtimeStopReason: string
  promptTokens: number | undefined
  predictedTokens: number | undefined
}>

export type ModelTrace = (record: ModelTraceRecord) => Promise<void>

export type ModelAccess = {
  call<T>(
    site: string,
    turns: CallTurns,
    schema: z.ZodType<T>,
    signal: AbortSignal,
    onState?: (state: CallState) => void,
  ): Promise<CallResult<T>>

  status(): Promise<RuntimeStatus>
}
