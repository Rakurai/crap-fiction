import { beforeEach, describe, expect, it } from 'vitest'
import {
  readStoredAuthorContextConversationId,
  writeStoredAuthorContextConversationId,
} from '../../../src/client/authorContextSelection.js'

describe('author-context conversation selection', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('has nothing stored before any selection is made', () => {
    expect(readStoredAuthorContextConversationId()).toBeUndefined()
  })

  it('reads back a written selection, surviving a reload of the module', () => {
    writeStoredAuthorContextConversationId('conv-1')

    expect(readStoredAuthorContextConversationId()).toBe('conv-1')
  })

  it('reads back a written null selection as null, not as nothing stored', () => {
    writeStoredAuthorContextConversationId(null)

    expect(readStoredAuthorContextConversationId()).toBeNull()
  })
})
