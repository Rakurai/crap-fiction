import type { FixtureBehavior } from './modelAdapter.js'

const CALL_MS = 400

const STILL_IN_FLIGHT_MS = 6 * CALL_MS

export const APPLIED_TEXT = 'The cups sat where she had left them, and the light came up behind the harbour.'

export const SUGGESTION_CLAIM = 'the opening holds two beats where one would carry it'

export const EDITOR_SUGGESTION_CLAIM = 'the piece keeps returning to the harbour without ever having named it'

export const INTERVIEWER_QUESTION = 'what does the harbour cost her to leave?'

function commentary(claim: string, delayMs: number): FixtureBehavior {
  return { result: { outcome: 'value', value: { kind: 'response', outcome: 'commentary', claim } }, delayMs }
}

function applicableSuggestion(claim: string, note: string, delayMs: number): FixtureBehavior {
  return { result: { outcome: 'value', value: { kind: 'response', outcome: 'applicableSuggestion', claim, note } }, delayMs }
}

export const FIXTURE_ANSWERS: Readonly<Record<string, FixtureBehavior>> = {
  change: applicableSuggestion(SUGGESTION_CLAIM, 'a suggestion from the fixture model implementation', CALL_MS),
  character: commentary('a reading from the fixture model implementation', CALL_MS),
  economy: commentary('a reading from the fixture model implementation', CALL_MS),
  reader: commentary('a reading from the fixture model implementation', STILL_IN_FLIGHT_MS),
  'story-editor': applicableSuggestion(EDITOR_SUGGESTION_CLAIM, 'an answer from the fixture model implementation', CALL_MS),
  interview: commentary(INTERVIEWER_QUESTION, CALL_MS),
  apply: { result: { outcome: 'value', value: { replacement: APPLIED_TEXT } }, delayMs: 4 * CALL_MS },
}
