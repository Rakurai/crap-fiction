import { z } from 'zod'

/**
 * Whether the model runtime answered, and what it has loaded. The rest of the
 * model seam's vocabulary — the failure taxonomy, the call outcomes, the
 * adapter interface — is the server's own and stays there; this is the only
 * part of it the interface is told about.
 */
export const runtimeStatusSchema = z
  .discriminatedUnion('reachable', [
    z.object({ reachable: z.literal(true), models: z.array(z.string()).readonly() }),
    z.object({ reachable: z.literal(false) }),
  ])
  .readonly()

export type RuntimeStatus = z.infer<typeof runtimeStatusSchema>
