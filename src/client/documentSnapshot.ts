import type { DocumentSnapshot } from '../shared/surfaces.js'

/**
 * The closed snapshot an author action or an Apply carries: the draft and the story context as
 * their own editing surfaces currently hold them, unsaved text included, alongside author context
 * as the piece last opened with — the only text there is for it until its own editing surface
 * exists.
 */
export function documentSnapshotFrom(draftMarkdown: string, storyContextText: string, authorContextText: string): DocumentSnapshot {
  return { draft: draftMarkdown, storyContext: storyContextText, authorContext: authorContextText }
}
