import { describe, expect, it } from 'vitest'
import type { PieceSurfaces, SurfaceDetail } from '../../../src/shared/pieceViews.js'
import { documentSnapshotFrom } from '../../../src/client/documentSnapshot.js'

function surface(text: string): SurfaceDetail {
  return { text, referenceSchema: null, currentConversationId: null, conversations: [], cast: [] }
}

describe('documentSnapshotFrom', () => {
  it('carries the manuscript exactly as the editor holds it, not the text the piece last saved, alongside story and author context as the piece opened with', () => {
    const surfaces: PieceSurfaces = {
      draft: surface('the saved draft'),
      storyContext: surface('the story context'),
      authorContext: surface('the author context'),
    }

    const snapshot = documentSnapshotFrom('the unsaved draft', surfaces)

    expect(snapshot).toEqual({ draft: 'the unsaved draft', storyContext: 'the story context', authorContext: 'the author context' })
  })
})
