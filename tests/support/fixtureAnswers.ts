import type { FixtureBehavior } from './modelAdapter.js'

/**
 * What the fixture studio answers, kept apart from the entry that stands the
 * studio up so a browser journey can name the same prose it is about to see
 * without importing an entry — importing that module *starts* a studio, which
 * is what makes it an entry rather than a factory.
 *
 * A reading of the author's actual prose is not something a fixture can have, so
 * every answer here says it came from the fixture. What is scripted is only what
 * a browser journey needs to reach: one response offering an action, so Apply is
 * on screen at all; an application returning prose, so the manuscript visibly
 * changes; a capture returning one proposal; and a delay on every call, so a
 * round is in flight long enough for the author to be typing during it.
 */

/** Long enough that a round is observably in flight, short enough that five of them are not a wait. */
const CALL_MS = 400

/**
 * The prose an application returns. Fixed text rather than anything derived from
 * the draft, because a fixture has no reading of the author's prose to revise —
 * which makes every application a whole rewrite, and that is what the record
 * then says it was.
 */
export const APPLIED_MANUSCRIPT = 'The cups sat where she had left them, and the light came up behind the harbour.'

/** The claim on the one response that offers Apply. */
export const SUGGESTION_CLAIM = 'the opening holds two beats where one would carry it'

function commentary(claim: string): FixtureBehavior {
  return { result: { outcome: 'value', value: { kind: 'response', outcome: 'commentary', claim } }, delayMs: CALL_MS }
}

export const FIXTURE_ANSWERS: Readonly<Record<string, FixtureBehavior>> = {
  // One applicable suggestion, so a response on screen offers Apply.
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
  // Longer than a participant call: the read-only manuscript is a state a
  // journey has to catch the surface in, not one it infers afterwards.
  apply: { result: { outcome: 'value', value: { manuscript: APPLIED_MANUSCRIPT } }, delayMs: 4 * CALL_MS },
  capture: {
    result: {
      outcome: 'value',
      value: {
        proposals: [
          {
            destination: 'storyContext',
            section: 'Places',
            operation: 'add',
            text: 'The harbour is east of the house, so the morning light arrives over the water.',
          },
        ],
      },
    },
    delayMs: CALL_MS,
  },
}
