import type { SurfaceId } from '../shared/surfaces.js'

/** A value held per editing surface, so one surface's state never bleeds into another's. */
export type BySurface<T> = Readonly<Partial<Record<SurfaceId, T>>>

export function withSurface<T>(surface: SurfaceId, value: T | undefined): (current: BySurface<T>) => BySurface<T> {
  return (current) => ({ ...current, [surface]: value })
}
