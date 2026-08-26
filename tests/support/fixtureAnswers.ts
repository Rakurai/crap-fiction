import type { FixtureBehavior } from './modelAdapter.js'

const CALL_MS = 400

const SLOW_CALL_MS = 6 * CALL_MS

export const APPLIED_TEXT = 'The cups sat where she had left them, and the light came up behind the harbour.'

export const SUGGESTION_CLAIM = 'the opening holds two beats where one would carry it'

export const EDITOR_SUGGESTION_CLAIM = 'the piece keeps returning to the harbour without ever having named it'

function commentary(claim: string, delayMs: number): FixtureBehavior {
  return { result: { outcome: 'value', value: { kind: 'response', outcome: 'commentary', claim } }, delayMs }
}

function applicableSuggestion(claim: string, note: string, delayMs: number): FixtureBehavior {
  return { result: { outcome: 'value', value: { kind: 'response', outcome: 'applicableSuggestion', claim, note } }, delayMs }
}

export const FIXTURE_ANSWERS: Readonly<Record<string, FixtureBehavior>> = {
  shape: applicableSuggestion(SUGGESTION_CLAIM, 'a suggestion from the fixture model implementation', CALL_MS),
  'reader-experience': commentary('a reading from the fixture model implementation', CALL_MS),
  compression: commentary('a reading from the fixture model implementation', CALL_MS),
  // Slow, so a draft dispatch is still in flight while a journey acts elsewhere in the studio.
  interiority: commentary('a reading from the fixture model implementation', SLOW_CALL_MS),
  // The only participant a context surface has, so its answer is what a context Apply acts on.
  'story-editor': applicableSuggestion(EDITOR_SUGGESTION_CLAIM, 'an answer from the fixture model implementation', CALL_MS),
  apply: { result: { outcome: 'value', value: { replacement: APPLIED_TEXT } }, delayMs: 4 * CALL_MS },
}
