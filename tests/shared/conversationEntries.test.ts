import { describe, expect, it } from 'vitest'
import {
  applicationEntrySchema,
  authorMessageEntrySchema,
  concreteChangeRequestEntrySchema,
  conversationEntrySchema,
  entryConversationSchema,
  participantFailureEntrySchema,
  participantNoCommentEntrySchema,
  participantResponseEntrySchema,
} from '../../src/shared/conversationEntries.js'

describe('an author message entry', () => {
  it('carries the verbatim text, its resolved audience and any specialist addressing brought in', () => {
    const parsed = authorMessageEntrySchema.safeParse({
      id: 'e1',
      kind: 'authorMessage',
      text: 'what does @compression make of the opening',
      audience: ['compression'],
      brought: ['compression'],
    })
    expect(parsed.success).toBe(true)
  })
})

describe('a concrete-change request entry', () => {
  it('is durable with no author text, carrying its target and the response it answers', () => {
    const parsed = concreteChangeRequestEntrySchema.safeParse({
      id: 'e2',
      kind: 'concreteChangeRequest',
      target: 'shape',
      respondingTo: 'e1',
    })
    expect(parsed.success).toBe(true)
  })

  it('carries the author clarification verbatim where one was supplied', () => {
    const parsed = concreteChangeRequestEntrySchema.parse({
      id: 'e2',
      kind: 'concreteChangeRequest',
      target: 'shape',
      respondingTo: 'e1',
      clarification: 'just the opening line',
    })
    expect(parsed.clarification).toBe('just the opening line')
  })
})

describe('a participant response entry', () => {
  it('preserves claim and note as distinct fields, never merging one into the other', () => {
    const parsed = participantResponseEntrySchema.parse({
      id: 'e3',
      kind: 'participantResponse',
      participantId: 'shape',
      causeId: 'e1',
      outcome: 'commentary',
      claim: 'the opening is late',
      note: 'by about a paragraph',
    })
    expect(parsed.claim).toBe('the opening is late')
    expect(parsed.note).toBe('by about a paragraph')
  })

  it('does not conform without a claim, so a nonconforming model result cannot become one', () => {
    expect(
      participantResponseEntrySchema.safeParse({
        id: 'e3',
        kind: 'participantResponse',
        participantId: 'shape',
        causeId: 'e1',
        outcome: 'commentary',
        note: 'by about a paragraph',
      }).success,
    ).toBe(false)
  })

  it('carries the durable entry that caused it', () => {
    const parsed = participantResponseEntrySchema.parse({
      id: 'e3',
      kind: 'participantResponse',
      participantId: 'shape',
      causeId: 'e1',
      outcome: 'applicableSuggestion',
      claim: 'cut the second paragraph',
    })
    expect(parsed.causeId).toBe('e1')
  })
})

describe('a participant no-comment entry', () => {
  it('is a craft outcome distinct from failure, carrying the participant and its cause', () => {
    const parsed = participantNoCommentEntrySchema.parse({ id: 'e4', kind: 'participantNoComment', participantId: 'compression', causeId: 'e1' })
    expect(parsed).toEqual({ id: 'e4', kind: 'participantNoComment', participantId: 'compression', causeId: 'e1' })
  })
})

describe('a participant failure entry', () => {
  it('carries the failure reason and what came back, distinctly from silence', () => {
    const parsed = participantFailureEntrySchema.parse({
      id: 'e5',
      kind: 'participantFailure',
      participantId: 'compression',
      causeId: 'e1',
      reason: 'nonconforming',
      returned: '{"outcome":"commentary"}',
    })
    expect(parsed.reason).toBe('nonconforming')
  })
})

describe('an application entry', () => {
  it('carries the response that caused it and the applied-change reference, not a round coordinate', () => {
    const parsed = applicationEntrySchema.parse({ id: 'e6', kind: 'application', responseId: 'e3', changeId: 'c1' })
    expect(parsed).toEqual({ id: 'e6', kind: 'application', responseId: 'e3', changeId: 'c1' })
  })
})

describe('the conversation entry union', () => {
  it('discriminates on kind and refuses one this conversation has no entry for', () => {
    expect(conversationEntrySchema.safeParse({ id: 'e7', kind: 'roundOpened', roundId: 'r1' }).success).toBe(false)
  })

  it('parses one of each kind through the shared union', () => {
    const kinds = ['authorMessage', 'concreteChangeRequest', 'participantResponse', 'participantNoComment', 'participantFailure', 'application']
    for (const kind of kinds) {
      expect(conversationEntrySchema.safeParse({ id: 'e', kind, ...minimalFieldsFor(kind) }).success).toBe(true)
    }
  })
})

function minimalFieldsFor(kind: string): Record<string, unknown> {
  switch (kind) {
    case 'authorMessage':
      return { text: 'hello', audience: [], brought: [] }
    case 'concreteChangeRequest':
      return { target: 'shape', respondingTo: 'e0' }
    case 'participantResponse':
      return { participantId: 'shape', causeId: 'e0', outcome: 'commentary', claim: 'x' }
    case 'participantNoComment':
      return { participantId: 'shape', causeId: 'e0' }
    case 'participantFailure':
      return { participantId: 'shape', causeId: 'e0', reason: 'timeout' }
    case 'application':
      return { responseId: 'e0', changeId: 'c0' }
    default:
      return {}
  }
}

describe('a conversation of entries', () => {
  it('keeps entries in the order they are given, which is the order they are appended in', () => {
    const conversation = entryConversationSchema.parse({
      id: 'c1',
      entries: [
        { id: 'e1', kind: 'authorMessage', text: 'hello room', audience: [], brought: [] },
        { id: 'e2', kind: 'participantResponse', participantId: 'shape', causeId: 'e1', outcome: 'commentary', claim: 'the opening is late' },
      ],
    })
    expect(conversation.entries.map((entry) => entry.id)).toEqual(['e1', 'e2'])
  })
})
