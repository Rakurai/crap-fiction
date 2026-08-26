import type { DocumentSnapshot } from '../shared/surfaces.js'

/**
 * The closed snapshot an author action or an Apply carries: all three documents as their own
 * editing surfaces currently hold them, unsaved text included.
 */
export function documentSnapshotFrom(draftMarkdown: string, storyContextText: string, authorContextText: string): DocumentSnapshot {
  return { draft: draftMarkdown, storyContext: storyContextText, authorContext: authorContextText }
}
