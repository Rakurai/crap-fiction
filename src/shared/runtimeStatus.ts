import { z } from 'zod'

export const runtimeStatusSchema = z
  .discriminatedUnion('reachable', [
    z.object({ reachable: z.literal(true), models: z.array(z.string()).readonly() }),
    z.object({ reachable: z.literal(false) }),
  ])
  .readonly()

export type RuntimeStatus = z.infer<typeof runtimeStatusSchema>
