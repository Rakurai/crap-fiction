import { z } from 'zod'

export const surfaceIdSchema = z.enum(['draft', 'storyContext', 'authorContext'])

export type SurfaceId = z.infer<typeof surfaceIdSchema>

// The two surfaces that live under a piece, as distinct from the global author-context surface.
export const pieceSurfaceIdSchema = z.enum(['draft', 'storyContext'])

export type PieceSurfaceId = z.infer<typeof pieceSurfaceIdSchema>
