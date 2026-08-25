import { z } from 'zod'
import type { DispatchOpening } from './room.js'

/**
 * The three shapes a dispatch request may arrive in, and which act each one names. The route
 * validates and forwards; deciding that a body carrying `respondingTo` is an ask, and one
 * carrying `target` a reply to one participant, is the room's own reading of its request.
 */
export const dispatchRequestSchema = z.union([
  z.strictObject({ message: z.string().min(1), draft: z.string() }),
  z.strictObject({ target: z.string().min(1), message: z.string().min(1), draft: z.string() }),
  z.strictObject({
    respondingTo: z.string().min(1),
    clarification: z.string().min(1).optional(),
    draft: z.string(),
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
