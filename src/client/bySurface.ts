import type { SurfaceId } from '../shared/surfaces.js'

/** A value held per editing surface, so one surface's state never bleeds into another's. */
export type BySurface<T> = Readonly<Partial<Record<SurfaceId, T>>>
