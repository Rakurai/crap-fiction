import { describe, expect, it } from 'vitest'
import { eligibleResponseValueSchema, owedResponseValueSchema, responseValueSchema } from '../../src/shared/participantResponse.js'

describe('eligibleResponseValueSchema', () => {
  it('accepts a no-comment outcome with no claim and no note', () => {
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'noComment' }).success).toBe(true)
  })

  it('accepts a claim standing alone, with no note', () => {
    const result = eligibleResponseValueSchema.safeParse({ outcome: 'commentary', claim: 'the entry is late' })
    expect(result.success).toBe(true)
  })

  it('rejects a commentary outcome with no claim: a response that says anything states one', () => {
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'commentary' }).success).toBe(false)
  })

  it('rejects an applicable suggestion with no claim', () => {
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'applicableSuggestion' }).success).toBe(false)
  })
})

describe('owedResponseValueSchema', () => {
  it('has no no-comment outcome in its schema at all', () => {
    expect(owedResponseValueSchema.safeParse({ outcome: 'noComment', claim: 'x' }).success).toBe(false)
  })

  it('requires a claim for the outcomes it does allow', () => {
    expect(owedResponseValueSchema.safeParse({ outcome: 'commentary' }).success).toBe(false)
  })

  it('accepts a claim with an optional note', () => {
    expect(owedResponseValueSchema.safeParse({ outcome: 'applicableSuggestion', claim: 'cut the last line', note: 'it repeats the image' }).success).toBe(true)
  })
})

describe('responseValueSchema', () => {
  it('selects the owed schema when the call owes an answer', () => {
    expect(responseValueSchema(true)).toBe(owedResponseValueSchema)
  })

  it('selects the eligible schema when the call does not owe an answer', () => {
    expect(responseValueSchema(false)).toBe(eligibleResponseValueSchema)
  })
})
