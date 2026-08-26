import type { FixtureBehavior } from './modelAdapter.js'

const CALL_MS = 400

const SLOW_CALL_MS = 6 * CALL_MS

export const APPLIED_MANUSCRIPT = 'The cups sat where she had left them, and the light came up behind the harbour.'

export const SUGGESTION_CLAIM = 'the opening holds two beats where one would carry it'

function commentary(claim: string, delayMs: number): FixtureBehavior {
  return { result: { outcome: 'value', value: { kind: 'response', outcome: 'commentary', claim } }, delayMs }
}

export const FIXTURE_ANSWERS: Readonly<Record<string, FixtureBehavior>> = {
  shape: {
    result: {
      outcome: 'value',
      value: {
        kind: 'response',
        outcome: 'applicableSuggestion',
        claim: SUGGESTION_CLAIM,
        note: 'a suggestion from the fixture model implementation',
      },
    },
    delayMs: CALL_MS,
  },
  'reader-experience': commentary('a reading from the fixture model implementation', CALL_MS),
  compression: commentary('a reading from the fixture model implementation', CALL_MS),
  // The slow answer of the draft's cast, so a dispatch is still visibly in flight for long enough
  // that a journey can act on the studio while the room is working.
  interiority: commentary('a reading from the fixture model implementation', SLOW_CALL_MS),
  'story-editor': commentary('an answer from the fixture model implementation', CALL_MS),
  apply: { result: { outcome: 'value', value: { manuscript: APPLIED_MANUSCRIPT } }, delayMs: 4 * CALL_MS },
}
