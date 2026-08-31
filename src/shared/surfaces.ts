import { z } from 'zod'

export const surfaceIdSchema = z.enum(['draft', 'storyContext', 'authorContext'])

export type SurfaceId = z.infer<typeof surfaceIdSchema>

const pieceSurfaceIdSchema = surfaceIdSchema.exclude(['authorContext'])

export type PieceSurfaceId = z.infer<typeof pieceSurfaceIdSchema>

export const SURFACE_IDS: readonly SurfaceId[] = surfaceIdSchema.options

export const documentSnapshotSchema = z.object({ draft: z.string(), storyContext: z.string(), authorContext: z.string() }).readonly()

export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>
