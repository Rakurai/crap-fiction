import { describe, expect, it } from 'vitest'
import { dispatchActivitySnapshotSchema, participantActivityEventSchema } from '../../src/shared/conversationEvents.js'

describe('participantActivityEventSchema', () => {
  it('carries the server-stamped moment its call started, and refuses a frame missing one', () => {
    const event = { actionId: 'a1', participantId: 'shape', state: 'working', startedAt: 1_700_000_000_000, surface: 'draft' }
    expect(participantActivityEventSchema.safeParse(event).success).toBe(true)

    const { startedAt: _startedAt, ...withoutStartedAt } = event
    expect(participantActivityEventSchema.safeParse(withoutStartedAt).success).toBe(false)
  })
})

describe('dispatchActivitySnapshotSchema', () => {
  it("holds each participant's state and start moment together, refusing a bare state string", () => {
    const snapshot = {
      actionId: 'a1',
      conversationId: 'c1',
      kind: 'dispatch',
      sourceEntryId: 'e0',
      audience: ['shape'],
      states: { shape: { state: 'working', startedAt: 1_700_000_000_000 } },
      startedAt: 1_700_000_000_000,
    }
    expect(dispatchActivitySnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(dispatchActivitySnapshotSchema.safeParse({ ...snapshot, states: { shape: 'working' } }).success).toBe(false)
  })
})
