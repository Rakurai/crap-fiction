import { z } from 'zod'

export const surfaceIdSchema = z.enum(['draft', 'storyContext', 'authorContext'])

export type SurfaceId = z.infer<typeof surfaceIdSchema>
