import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { owedResponseValueSchema, responseValueSchema } from '../../src/shared/participantResponse.js'

const flatSchema = z.object({
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), z.object({ minLength: z.number().optional() })),
})

describe('the JSON Schema a participant is asked to answer in', () => {
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
