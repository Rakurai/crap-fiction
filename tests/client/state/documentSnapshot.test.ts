import { describe, expect, it } from 'vitest'
import { documentSnapshotFrom } from '../../../src/client/documentSnapshot.js'

describe('documentSnapshotFrom', () => {
  it('carries the draft and story context exactly as their own surfaces hold them, not the text either last saved, alongside author context as the piece opened with', () => {
    const snapshot = documentSnapshotFrom('the unsaved draft', 'the unsaved story context', 'the author context')

    expect(snapshot).toEqual({ draft: 'the unsaved draft', storyContext: 'the unsaved story context', authorContext: 'the author context' })
  })
})
