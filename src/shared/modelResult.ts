import { z } from 'zod'

/**
 * SPEC "Model access": the failure taxonomy is the product's own. Declared
 * here rather than only in `src/server/model/types.ts` because a failed
 * participant's record is part of what the client reads back from a
 * conversation and an SSE event, and `zod` is the single declaration.
 */
export const failureReasonSchema = z.enum(['unconfigured', 'unreachable', 'timeout', 'nonconforming'])

export type FailureReason = z.infer<typeof failureReasonSchema>
