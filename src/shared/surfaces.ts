import { z } from 'zod'

export const surfaceIdSchema = z.enum(['draft', 'storyContext', 'authorContext'])

export type SurfaceId = z.infer<typeof surfaceIdSchema>

// The only surface anything is worked through yet: every cast, dispatch and operation is the draft's.
export const WORKED_SURFACE: SurfaceId = 'draft'
