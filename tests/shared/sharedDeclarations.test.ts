import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { applyResultSchema, replacementSchema } from '../../src/shared/applyResult.js'
import { applyOutcomeSchema, pendingApplySchema } from '../../src/shared/applyViews.js'
import { participantResponseEntrySchema } from '../../src/shared/conversationEntries.js'
import {
  conversationFailureCodeSchema,
  participantActivityEventSchema,
  participantStageSchema,
  participantStateSchema,
  roomEventNameSchema,
  roomEventSchema,
} from '../../src/shared/conversationEvents.js'
import { failureCodeSchema, responseEnvelopeSchema } from '../../src/shared/envelope.js'
import { responseOutcomeSchema, substantiveOutcomeSchema } from '../../src/shared/participantResponse.js'

const envelope = responseEnvelopeSchema(z.string())

describe('the failure-code taxonomy', () => {
  it('answers both channels from one closed set, refusing a code the set does not hold', () => {
    expect(envelope.safeParse({ success: false, error: { code: 'CONVERSATION_NOT_WRITTEN', message: 'm' } }).success).toBe(true)
    expect(envelope.safeParse({ success: false, error: { code: 'NOT_A_FAILURE_CODE', message: 'm' } }).success).toBe(false)
    expect(envelope.safeParse({ success: true, data: 'x' }).success).toBe(true)

    for (const code of conversationFailureCodeSchema.options) {
      expect(failureCodeSchema.safeParse(code).success).toBe(true)
    }
    expect(conversationFailureCodeSchema.safeParse('ROOM_BUSY').success).toBe(false)
  })
})

describe('the response outcomes', () => {
  it('name the substantive pair once, so a durable entry cannot carry the silent outcome', () => {
    expect(responseOutcomeSchema.safeParse('noComment').success).toBe(true)
    expect(substantiveOutcomeSchema.safeParse('noComment').success).toBe(false)

    const entry = { id: 'e1', kind: 'participantResponse', participantId: 'shape', causeId: 'c1', claim: 'x' }
    for (const outcome of substantiveOutcomeSchema.options) {
      expect(participantResponseEntrySchema.safeParse({ ...entry, outcome }).success).toBe(true)
    }
    expect(participantResponseEntrySchema.safeParse({ ...entry, outcome: 'noComment' }).success).toBe(false)
  })
})

describe('the participant-activity pair', () => {
  it('carries the same stage set on the live frame and in the snapshot', () => {
    for (const stage of participantStageSchema.options) {
      expect(participantStateSchema.safeParse({ state: stage, startedAt: 1 }).success).toBe(true)
      expect(participantActivityEventSchema.safeParse({ actionId: 'a1', participantId: 'shape', state: stage, startedAt: 1, surface: 'draft' }).success).toBe(true)
    }
    expect(participantStateSchema.safeParse({ state: 'waiting', startedAt: 1 }).success).toBe(false)
    expect(participantActivityEventSchema.safeParse({ actionId: 'a1', participantId: 'shape', state: 'waiting', startedAt: 1, surface: 'draft' }).success).toBe(false)
  })
})

describe('the event names', () => {
  it('are one closed set, and a frame the set does not name is refused', () => {
    expect(roomEventSchema.safeParse({ type: 'participant.activity', data: { actionId: 'a1', participantId: 'shape', state: 'called', startedAt: 1, surface: 'draft' } }).success).toBe(true)
    expect(roomEventSchema.safeParse({ type: 'participant.stage', data: {} }).success).toBe(false)

    for (const option of roomEventSchema.options) {
      for (const name of option.shape.type.options) {
        expect(roomEventNameSchema.safeParse(name).success).toBe(true)
      }
    }
  })
})

describe('the apply replacement', () => {
  it('is one rule the model result, the pending payload and the apply outcome all hold to', () => {
    expect(replacementSchema.safeParse('').success).toBe(false)
    expect(applyResultSchema.safeParse({ replacement: '' }).success).toBe(false)
    expect(pendingApplySchema.safeParse({ replacement: '' }).success).toBe(false)
    expect(applyOutcomeSchema.safeParse({ outcome: 'pending', actionId: 'a1', applicationId: 'ap1', replacement: '' }).success).toBe(false)
    expect(applyOutcomeSchema.safeParse({ outcome: 'pending', actionId: 'a1', applicationId: 'ap1', replacement: 'text' }).success).toBe(true)
  })
})
