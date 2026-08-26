import type { PieceSurfaces } from '../shared/pieceViews.js'
import type { DocumentSnapshot } from '../shared/surfaces.js'

/**
 * The closed snapshot an author action or an Apply carries: the draft as the manuscript editor
 * currently holds it, unsaved text included, alongside story context and author context as the
 * piece last opened with — the only text there is for either until an editing surface of its own
 * exists.
 */
export function documentSnapshotFrom(draftMarkdown: string, surfaces: PieceSurfaces): DocumentSnapshot {
  return { draft: draftMarkdown, storyContext: surfaces.storyContext.text, authorContext: surfaces.authorContext.text }
}
