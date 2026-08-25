import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { normalizeResponse, owedResponseValueSchema, responseValueSchema } from '../../src/shared/participantResponse.js'

/** As much of the JSON Schema conversion as the claim below is about. */
const flatSchema = z.object({
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), z.object({ minLength: z.number().optional() })),
})

describe('the JSON Schema a participant is asked to answer in', () => {
  /**
   * This is the shape that travels to the runtime, not the Zod declaration it is converted
   * from: what the model is told it owes is only as strong as the conversion the adapter sends.
   */
  it('obliges a claim, and only a claim, wherever the outcome is substantive', () => {
    const jsonSchema = flatSchema.parse(z.toJSONSchema(owedResponseValueSchema))

    expect(jsonSchema.required).toEqual(['outcome', 'claim'])
    expect(jsonSchema.properties.claim?.minLength).toBe(1)
    expect(jsonSchema.properties.note?.minLength).toBeUndefined()
  })

  it('withholds no comment from a participant that owes an answer, which the grammar can express', () => {
    expect(responseValueSchema(true).safeParse({ outcome: 'noComment' }).success).toBe(false)
    expect(responseValueSchema(false).safeParse({ outcome: 'noComment' }).success).toBe(true)
  })
})

describe('reading what a participant returned', () => {
  /**
   * One claim over every shape an answer arrives in: the claim is taken as written, and a note
   * counts as elaboration only where there is something in it.
   */
  it('takes a claim and a note as written, a claim standing alone as complete, a blank note as no note, and a declared no comment at its word', () => {
    expect(normalizeResponse({ outcome: 'applicableSuggestion', claim: 'cut the last line', note: 'it explains twice' })).toEqual({
      outcome: 'applicableSuggestion',
      claim: 'cut the last line',
      note: 'it explains twice',
    })
    expect(normalizeResponse({ outcome: 'commentary', claim: 'the opening is late' })).toEqual({
      outcome: 'commentary',
      claim: 'the opening is late',
      note: undefined,
    })
    expect(normalizeResponse({ outcome: 'commentary', claim: 'the opening is late', note: '   ' })).toEqual({
      outcome: 'commentary',
      claim: 'the opening is late',
      note: undefined,
    })
    expect(normalizeResponse({ outcome: 'noComment' })).toEqual({ outcome: 'noComment' })
  })
})
