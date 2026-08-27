import { z } from 'zod'
import { documentSnapshotSchema } from '../../shared/surfaces.js'
import type { DispatchOpening } from './room.js'

export const dispatchRequestSchema = z.union([
  z.strictObject({ message: z.string().min(1), documents: documentSnapshotSchema }),
  z.strictObject({ target: z.string().min(1), message: z.string().min(1), documents: documentSnapshotSchema }),
  z.strictObject({
    respondingTo: z.string().min(1),
    clarification: z.string().min(1).optional(),
    documents: documentSnapshotSchema,
  }),
])

export type DispatchRequest = z.infer<typeof dispatchRequestSchema>

export function dispatchOpening(request: DispatchRequest): DispatchOpening {
  if ('respondingTo' in request) {
    return { kind: 'ask', respondingTo: request.respondingTo, clarification: request.clarification }
  }
  if ('target' in request) return { kind: 'targeted', target: request.target, text: request.message }
  return { kind: 'message', text: request.message }
}
