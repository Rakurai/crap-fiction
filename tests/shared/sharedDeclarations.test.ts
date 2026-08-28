import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { applyResultSchema, replacementSchema } from '../../src/shared/applyResult.js'
import { applyFailureReasonSchema, applyOutcomeSchema, INAPPLICABLE, pendingApplySchema } from '../../src/shared/applyViews.js'
import { participantFailureEntrySchema, participantResponseEntrySchema } from '../../src/shared/conversationEntries.js'
import { failureReasonSchema } from '../../src/shared/modelResult.js'
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

describe('what applying asks the model for', () => {
  it('is a list of edits, one required, each quoting text and supplying its replacement, with the occurrence index a whole count from zero', () => {
    expect(applyResultSchema.safeParse({ edits: [{ find: 'the second cup', replace: 'the chipped cup' }] }).success).toBe(true)
    expect(applyResultSchema.safeParse({ edits: [{ find: 'the second cup', replace: 'the chipped cup', occurrence: 0 }] }).success).toBe(true)
    expect(applyResultSchema.safeParse({ edits: [] }).success).toBe(false)
    expect(applyResultSchema.safeParse({ replacement: 'the whole document' }).success).toBe(false)

    expect(applyResultSchema.safeParse({ edits: [{ find: 'a', replace: 'b', occurrence: -1 }] }).success).toBe(false)
    expect(applyResultSchema.safeParse({ edits: [{ find: 'a', replace: 'b', occurrence: 1.5 }] }).success).toBe(false)
  })
})

describe('the apply replacement', () => {
  it('is one rule the edit, the pending payload and the apply outcome all hold to, and the empty document a deletion leaves is legal', () => {
    expect(replacementSchema.safeParse('').success).toBe(true)
    expect(applyResultSchema.safeParse({ edits: [{ find: 'a', replace: '' }] }).success).toBe(true)
    expect(pendingApplySchema.safeParse({ replacement: '' }).success).toBe(true)
    expect(applyOutcomeSchema.safeParse({ outcome: 'pending', actionId: 'a1', applicationId: 'ap1', replacement: '' }).success).toBe(true)
    expect(applyOutcomeSchema.safeParse({ outcome: 'pending', actionId: 'a1', applicationId: 'ap1', replacement: 'text' }).success).toBe(true)
  })
})

describe('the two failure sets', () => {
  it('holds the reason only a document can cause outside the model\'s own set, so no participant failure can carry it', () => {
    for (const reason of failureReasonSchema.options) {
      expect(applyFailureReasonSchema.safeParse(reason).success).toBe(true)
    }
    expect(applyFailureReasonSchema.safeParse(INAPPLICABLE).success).toBe(true)
    expect(failureReasonSchema.safeParse(INAPPLICABLE).success).toBe(false)

    const failure = { id: 'e1', kind: 'participantFailure', participantId: 'shape', causeId: 'c1' }
    expect(participantFailureEntrySchema.safeParse({ ...failure, reason: 'timeout' }).success).toBe(true)
    expect(participantFailureEntrySchema.safeParse({ ...failure, reason: INAPPLICABLE }).success).toBe(false)
  })

  it('carries no returned value with the reason a document caused, where the answer was well-formed and its content is the author\'s prose', () => {
    const failed = { outcome: 'failed', actionId: 'a1' }
    expect(applyOutcomeSchema.parse({ ...failed, reason: INAPPLICABLE, returned: 'the prose it wrote' })).toEqual({ ...failed, reason: INAPPLICABLE })
    expect(applyOutcomeSchema.parse({ ...failed, reason: 'malformed', returned: 'not json' })).toEqual({ ...failed, reason: 'malformed', returned: 'not json' })
  })
})
