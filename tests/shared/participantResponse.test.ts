import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { eligibleResponseValueSchema, normalizeResponse, owedResponseValueSchema, responseValueSchema } from '../../src/shared/participantResponse.js'

type EmittedSchema = Readonly<{
  required?: readonly string[]
  properties: Readonly<Record<string, { minLength?: number }>>
}>

function emitted(schema: z.ZodType): EmittedSchema {
  return z.toJSONSchema(schema) as unknown as EmittedSchema
}

describe('the grammar a participant is decoded against', () => {
  it('obliges nothing of either field, so no runtime satisfies it by writing an empty one', () => {
    for (const schema of [eligibleResponseValueSchema, owedResponseValueSchema]) {
      const jsonSchema = emitted(schema)

      expect(jsonSchema.required).toEqual(['outcome'])
      expect(jsonSchema.properties.claim?.minLength).toBeUndefined()
      expect(jsonSchema.properties.note?.minLength).toBeUndefined()
    }
  })

  it('withholds no comment from a participant that owes an answer, which the grammar can express', () => {
    expect(responseValueSchema(true).safeParse({ outcome: 'noComment' }).success).toBe(false)
    expect(responseValueSchema(false).safeParse({ outcome: 'noComment' }).success).toBe(true)
  })

  it('accepts a reply that omits both fields, leaving the reading of it to the room', () => {
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'commentary' }).success).toBe(true)
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'commentary', claim: '', note: '' }).success).toBe(true)
  })
})

describe('reading what a participant returned', () => {
  it('takes a claim and note as written', () => {
    expect(normalizeResponse({ outcome: 'applicableSuggestion', claim: 'cut the last line', note: 'it explains twice' })).toEqual({
      outcome: 'applicableSuggestion',
      claim: 'cut the last line',
      note: 'it explains twice',
    })
  })

  it('reads a claim standing alone as a complete response', () => {
    expect(normalizeResponse({ outcome: 'commentary', claim: 'the opening is late' })).toEqual({
      outcome: 'commentary',
      claim: 'the opening is late',
      note: undefined,
    })
  })

  it('reads a blank note as no note rather than as an empty elaboration', () => {
    expect(normalizeResponse({ outcome: 'commentary', claim: 'the opening is late', note: '   ' })).toEqual({
      outcome: 'commentary',
      claim: 'the opening is late',
      note: undefined,
    })
  })

  it('takes the note as the claim where the reading was written there and the claim was left out', () => {
    expect(normalizeResponse({ outcome: 'applicableSuggestion', note: 'start with the light, not with her' })).toEqual({
      outcome: 'applicableSuggestion',
      claim: 'start with the light, not with her',
      note: undefined,
    })
  })

  it('treats an empty claim the same as an absent one', () => {
    expect(normalizeResponse({ outcome: 'commentary', claim: '', note: 'the opening is late' })).toEqual({
      outcome: 'commentary',
      claim: 'the opening is late',
      note: undefined,
    })
  })

  it('reads a reply that says nothing in either field as no response at all', () => {
    expect(normalizeResponse({ outcome: 'commentary' })).toBeUndefined()
    expect(normalizeResponse({ outcome: 'applicableSuggestion', claim: '', note: '  ' })).toBeUndefined()
  })

  it('takes the declared no comment at its word, whatever else came with it', () => {
    expect(normalizeResponse({ outcome: 'noComment', claim: 'but also', note: 'this' })).toEqual({ outcome: 'noComment' })
  })
})
