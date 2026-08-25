import type { FixtureBehavior } from './modelAdapter.js'

const CALL_MS = 400

export const APPLIED_MANUSCRIPT = 'The cups sat where she had left them, and the light came up behind the harbour.'

export const SUGGESTION_CLAIM = 'the opening holds two beats where one would carry it'

function commentary(claim: string): FixtureBehavior {
  return { result: { outcome: 'value', value: { kind: 'response', outcome: 'commentary', claim } }, delayMs: CALL_MS }
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
  'reader-experience': commentary('a reading from the fixture model implementation'),
  compression: commentary('a reading from the fixture model implementation'),
  interiority: commentary('a reading from the fixture model implementation'),
  'story-editor': commentary('an answer from the fixture model implementation'),
  apply: { result: { outcome: 'value', value: { manuscript: APPLIED_MANUSCRIPT } }, delayMs: 4 * CALL_MS },
}
