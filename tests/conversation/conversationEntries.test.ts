import { describe, expect, it } from 'vitest'
import { openingWords, type ConversationEntry } from '../../src/shared/conversationEntries.js'

const AUTHOR_MESSAGE: ConversationEntry = {
  id: 'e2',
  kind: 'authorMessage',
  text: 'does the opening earn its length',
  audience: [],
  brought: [],
}

const CHANGE_REQUEST: ConversationEntry = {
  id: 'e1',
  kind: 'concreteChangeRequest',
  target: 'shape',
  respondingTo: 'e0',
  clarification: 'just the opening line',
}

const NO_COMMENT: ConversationEntry = { id: 'e1', kind: 'participantNoComment', participantId: 'shape', causeId: 'e0' }

describe('openingWords', () => {
  it('takes the earliest entry the author wrote themselves, whichever act it was', () => {
    expect(openingWords([NO_COMMENT, CHANGE_REQUEST, AUTHOR_MESSAGE])).toBe('just the opening line')
    expect(openingWords([AUTHOR_MESSAGE, CHANGE_REQUEST])).toBe('does the opening earn its length')
  })

  it('reports none where the author wrote no verbatim text at all', () => {
    expect(openingWords([NO_COMMENT])).toBeUndefined()
    expect(openingWords([])).toBeUndefined()
  })
})
