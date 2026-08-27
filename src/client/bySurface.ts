import type { SurfaceId } from '../shared/surfaces.js'

export type BySurface<T> = Readonly<Partial<Record<SurfaceId, T>>>
