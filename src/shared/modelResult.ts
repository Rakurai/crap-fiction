import { z } from 'zod'

export const failureReasonSchema = z.enum(['unconfigured', 'unreachable', 'timeout', 'nonconforming'])

export type FailureReason = z.infer<typeof failureReasonSchema>
