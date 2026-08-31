import type { FixtureBehavior } from './modelAdapter.js'

const CALL_MS = 400

const STILL_IN_FLIGHT_MS = 6 * CALL_MS

function commentary(claim: string, delayMs: number): FixtureBehavior {
  return { result: { outcome: 'value', value: { outcome: 'commentary', claim } }, delayMs }
}

function applicableSuggestion(claim: string, note: string, delayMs: number): FixtureBehavior {
  return { result: { outcome: 'value', value: { outcome: 'applicableSuggestion', claim, note } }, delayMs }
}

export const FIXTURE_ANSWERS: Readonly<Record<string, FixtureBehavior>> = {
  change: applicableSuggestion('the opening holds two beats where one would carry it', 'a suggestion from the fixture model implementation', CALL_MS),
  character: commentary('a reading from the fixture model implementation', CALL_MS),
  economy: commentary('a reading from the fixture model implementation', CALL_MS),
  reader: commentary('a reading from the fixture model implementation', STILL_IN_FLIGHT_MS),
  'story-editor': applicableSuggestion(
    'the piece keeps returning to the harbour without ever having named it',
    'an answer from the fixture model implementation',
    CALL_MS,
  ),
  interview: commentary('what does the harbour cost her to leave?', CALL_MS),
  apply: {
    result: { outcome: 'value', value: { edits: [{ find: 'harbour', replace: 'harbour, and the light coming up behind it' }] } },
    delayMs: 4 * CALL_MS,
  },
}
