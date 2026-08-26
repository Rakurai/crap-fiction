import type { SurfaceId } from '../shared/surfaces.js'

/** What a control that switches to a surface is called, wherever one is drawn. */
export const SURFACE_CONTROL_LABEL: Readonly<Record<SurfaceId, string>> = {
  draft: 'draft',
  storyContext: 'story context',
  authorContext: 'author context',
}
