import { z } from 'zod'

export const failureReasonSchema = z.enum(['unconfigured', 'unreachable', 'timeout', 'malformed', 'nonconforming', 'internal'])

export type FailureReason = z.infer<typeof failureReasonSchema>
