import { z } from 'zod'

export const surfaceIdSchema = z.enum(['draft', 'storyContext', 'authorContext'])

export type SurfaceId = z.infer<typeof surfaceIdSchema>

export const pieceSurfaceIdSchema = z.enum(['draft', 'storyContext'])

export type PieceSurfaceId = z.infer<typeof pieceSurfaceIdSchema>

export const SURFACE_IDS: readonly SurfaceId[] = surfaceIdSchema.options

/**
 * The current client text of every surface's document, closed over at the moment an author
 * action or an Apply is submitted — including unsaved text and text whose save is failing.
 */
export const documentSnapshotSchema = z.object({ draft: z.string(), storyContext: z.string(), authorContext: z.string() }).readonly()

export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>
