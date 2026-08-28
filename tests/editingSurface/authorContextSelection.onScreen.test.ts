import { beforeEach, describe, expect, it } from 'vitest'
import {
  readStoredAuthorContextConversationId,
  writeStoredAuthorContextConversationId,
} from '../../src/client/authorContextSelection.js'

describe('author-context conversation selection', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('tells a selection never made from a selection of no conversation, and reads either back as it was written', () => {
    expect(readStoredAuthorContextConversationId()).toBeUndefined()

    writeStoredAuthorContextConversationId('conv-1')
    expect(readStoredAuthorContextConversationId()).toBe('conv-1')

    writeStoredAuthorContextConversationId(null)
    expect(readStoredAuthorContextConversationId()).toBeNull()
  })
})
