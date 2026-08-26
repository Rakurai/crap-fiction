import type { SurfaceId } from '../shared/surfaces.js'

export const SURFACE_CONTROL_LABEL: Readonly<Record<SurfaceId, string>> = {
  draft: 'draft',
  storyContext: 'story context',
  authorContext: 'author context',
}
