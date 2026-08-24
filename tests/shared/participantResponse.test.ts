import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { eligibleResponseValueSchema, normalizeResponse, owedResponseValueSchema, responseValueSchema } from '../../src/shared/participantResponse.js'

type FlatSchema = Readonly<{
  required?: readonly string[]
  properties: Readonly<Record<string, { minLength?: number }>>
}>

describe('the grammar a participant is decoded against', () => {
  it('obliges a claim, and only a claim, wherever the outcome is substantive', () => {
    const jsonSchema = z.toJSONSchema(owedResponseValueSchema) as unknown as FlatSchema

    expect(jsonSchema.required).toEqual(['outcome', 'claim'])
    expect(jsonSchema.properties.claim?.minLength).toBe(1)
    expect(jsonSchema.properties.note?.minLength).toBeUndefined()
  })

  it('withholds no comment from a participant that owes an answer, which the grammar can express', () => {
    expect(responseValueSchema(true).safeParse({ outcome: 'noComment' }).success).toBe(false)
    expect(responseValueSchema(false).safeParse({ outcome: 'noComment' }).success).toBe(true)
  })

  it('does not conform where a substantive outcome carries no claim, or an empty one', () => {
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'commentary' }).success).toBe(false)
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'commentary', claim: '', note: 'the opening is late' }).success).toBe(false)
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'commentary', claim: '   ' }).success).toBe(false)
  })

  it('trims a claim written with surrounding whitespace, rather than carrying it verbatim', () => {
    const parsed = eligibleResponseValueSchema.safeParse({ outcome: 'commentary', claim: '  the opening is late  ' })
    expect(parsed).toMatchObject({ success: true, data: { claim: 'the opening is late' } })
  })

  it('accepts a reply that omits the note, leaving elaboration optional', () => {
    expect(eligibleResponseValueSchema.safeParse({ outcome: 'commentary', claim: 'the opening is late' }).success).toBe(true)
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

  it('takes the declared no comment at its word', () => {
    expect(normalizeResponse({ outcome: 'noComment' })).toEqual({ outcome: 'noComment' })
  })
})
